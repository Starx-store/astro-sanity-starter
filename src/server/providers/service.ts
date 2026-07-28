import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  providers,
  providerProducts,
  providerApiLogs,
  products,
  type Provider,
} from "@/server/db/schema";
import { AppError, isPgError } from "@/server/errors";
import { encryptSecret, decryptSecret } from "@/server/crypto";
import { getAdapter, type ProviderContext } from "./adapters";

/**
 * خدمة المزوّدين: CRUD مع تشفير الأسرار at-rest، بناء سياق المحوّل،
 * تسجيل استدعاءات API (منقّاة من الأسرار)، وربط المنتجات.
 * الأسرار لا تخرج للواجهة أبدًا.
 */

interface StoredCreds {
  credentials: Record<string, string>;
  config: Record<string, unknown>;
}

function packCreds(
  credentials: Record<string, string>,
  config: Record<string, unknown>,
): string {
  return encryptSecret(JSON.stringify({ credentials, config } satisfies StoredCreds));
}

function unpackCreds(encrypted: string | null): StoredCreds {
  if (!encrypted) return { credentials: {}, config: {} };
  try {
    const parsed = JSON.parse(decryptSecret(encrypted)) as StoredCreds;
    return {
      credentials: parsed.credentials ?? {},
      config: parsed.config ?? {},
    };
  } catch {
    return { credentials: {}, config: {} };
  }
}

/** بناء سياق المحوّل (بأسرار مفكوكة) — خادمي فقط. */
export function buildContext(provider: Provider): ProviderContext {
  const { credentials, config } = unpackCreds(provider.credentials);
  return { baseUrl: provider.baseUrl, credentials, config };
}

/** تسجيل استدعاء API للمزوّد — requestSummary منقّى من الأسرار مسبقًا. */
export async function logApiCall(params: {
  providerId: string;
  orderId?: string | null;
  endpoint: string;
  requestSummary: Record<string, unknown>;
  responsePayload: unknown;
  httpStatus?: number | null;
  latencyMs: number;
  success: boolean;
}): Promise<void> {
  try {
    await db.insert(providerApiLogs).values({
      providerId: params.providerId,
      orderId: params.orderId ?? null,
      requestEndpoint: params.endpoint,
      requestPayload: params.requestSummary,
      responsePayload:
        params.responsePayload === undefined
          ? null
          : (params.responsePayload as object),
      httpStatus: params.httpStatus ?? null,
      latencyMs: params.latencyMs,
      success: params.success,
    });
  } catch (e) {
    console.error("[providers] فشل تسجيل استدعاء API:", e);
  }
}

/* ------------------------------------------------------------------ */
/*  CRUD                                                               */
/* ------------------------------------------------------------------ */

export interface ProviderInput {
  name: string;
  baseUrl: string;
  adapter: string;
  markupType: "fixed" | "percent";
  markupValue: string;
  status: "active" | "paused";
  credentials: Record<string, string>;
  config: Record<string, unknown>;
}

export async function createProvider(input: ProviderInput): Promise<string> {
  getAdapter(input.adapter); // يتحقق أن المحوّل معروف
  const [row] = await db
    .insert(providers)
    .values({
      name: input.name,
      baseUrl: input.baseUrl,
      adapter: input.adapter,
      markupType: input.markupType,
      markupValue: input.markupValue,
      status: input.status,
      credentials: packCreds(input.credentials, input.config),
    })
    .returning({ id: providers.id });
  return row.id;
}

/**
 * تحديث مزوّد. الحقول السرّية تُحدَّث فقط إذا أُرسلت قيم جديدة غير فارغة
 * (نمط "اترك فارغًا للإبقاء على الحالي").
 */
export async function updateProvider(
  id: string,
  input: ProviderInput,
): Promise<void> {
  getAdapter(input.adapter);
  const [existing] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, id))
    .limit(1);
  if (!existing) throw new AppError("not_found", "المزوّد غير موجود.", 404);

  const current = unpackCreds(existing.credentials);
  const mergedCreds: Record<string, string> = { ...current.credentials };
  for (const [k, v] of Object.entries(input.credentials)) {
    if (v && v.trim()) mergedCreds[k] = v.trim();
  }

  await db
    .update(providers)
    .set({
      name: input.name,
      baseUrl: input.baseUrl,
      adapter: input.adapter,
      markupType: input.markupType,
      markupValue: input.markupValue,
      status: input.status,
      credentials: packCreds(mergedCreds, input.config),
      updatedAt: new Date(),
    })
    .where(eq(providers.id, id));
}

export async function deleteProvider(id: string): Promise<void> {
  try {
    const deleted = await db
      .delete(providers)
      .where(eq(providers.id, id))
      .returning({ id: providers.id });
    if (deleted.length === 0)
      throw new AppError("not_found", "المزوّد غير موجود.", 404);
  } catch (e) {
    if (isPgError(e, "23503")) {
      throw new AppError(
        "provider_in_use",
        "لا يمكن حذف مزوّد مرتبط بطلبات — أوقفه بدل الحذف.",
        409,
      );
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/*  اختبار الاتصال والرصيد                                             */
/* ------------------------------------------------------------------ */

export async function testProviderConnection(
  id: string,
): Promise<{ ok: boolean; message: string; balance?: string | null }> {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, id))
    .limit(1);
  if (!provider) throw new AppError("not_found", "المزوّد غير موجود.", 404);

  const adapter = getAdapter(provider.adapter);
  const ctx = buildContext(provider);
  const started = Date.now();
  try {
    const result = await adapter.testConnection(ctx);
    await logApiCall({
      providerId: id,
      endpoint: "testConnection",
      requestSummary: { adapter: provider.adapter },
      responsePayload: { ok: result.ok, message: result.message },
      latencyMs: Date.now() - started,
      success: result.ok,
    });
    if (result.ok && result.balance != null) {
      await db
        .update(providers)
        .set({ balance: result.balance, updatedAt: new Date() })
        .where(eq(providers.id, id));
    }
    return result;
  } catch (e) {
    await logApiCall({
      providerId: id,
      endpoint: "testConnection",
      requestSummary: { adapter: provider.adapter },
      responsePayload: { error: String(e) },
      latencyMs: Date.now() - started,
      success: false,
    });
    return { ok: false, message: "فشل الاتصال بالمزوّد." };
  }
}

/* ------------------------------------------------------------------ */
/*  ربط المنتجات                                                       */
/* ------------------------------------------------------------------ */

export async function linkProduct(params: {
  providerId: string;
  productId: string;
  externalProductId: string;
  externalPrice?: string | null;
}): Promise<void> {
  try {
    await db
      .insert(providerProducts)
      .values({
        providerId: params.providerId,
        productId: params.productId,
        externalProductId: params.externalProductId,
        externalPrice: params.externalPrice ?? null,
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [providerProducts.providerId, providerProducts.productId],
        set: {
          externalProductId: params.externalProductId,
          externalPrice: params.externalPrice ?? null,
          isActive: true,
          lastSyncedAt: new Date(),
        },
      });
  } catch {
    throw new AppError("link_failed", "تعذّر ربط المنتج بالمزوّد.", 400);
  }
}

export async function unlinkProduct(providerProductId: string): Promise<void> {
  await db.delete(providerProducts).where(eq(providerProducts.id, providerProductId));
}

/** المزوّد المرتبط بمنتج (النشط) إن وُجد. */
export async function getProviderLinkForProduct(productId: string) {
  const [row] = await db
    .select({ link: providerProducts, provider: providers })
    .from(providerProducts)
    .innerJoin(providers, eq(providerProducts.providerId, providers.id))
    .where(
      and(
        eq(providerProducts.productId, productId),
        eq(providerProducts.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listRecentLogs(providerId: string, limit = 30) {
  return db
    .select()
    .from(providerApiLogs)
    .where(eq(providerApiLogs.providerId, providerId))
    .orderBy(desc(providerApiLogs.createdAt))
    .limit(limit);
}
