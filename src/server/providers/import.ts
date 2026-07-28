import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  products,
  productQuantityConfig,
  providerProducts,
  providers,
} from "@/server/db/schema";
import { AppError } from "@/server/errors";
import {
  parseAmount,
  toDbAmount,
  per1000ToUnit,
  applyMarkup,
  displayAmount,
} from "@/lib/money";
import { getProviderCatalog, evictCatalog } from "./catalog";
import { translateServiceName } from "./translate";

/**
 * استيراد خدمات المزوّد كمنتجات في المتجر.
 *
 * سعر البيع = سعر المزوّد لكل 1000 + الهامش (مبلغ ثابت أو نسبة).
 * يُخزَّن الهامش في الرابط، فتُعاد الحسبة تلقائيًا عند تغيّر سعر المزوّد
 * (انظر syncProviderPrices) — أي أن رفع المزوّد لسعره يرفع سعرنا فورًا.
 */

/** توليد slug فريد من اسم الخدمة. */
async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "service";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export interface ImportSelection {
  externalId: string;
  /** تجاوز اسم الخدمة (اختياري). */
  name?: string;
}

export async function importProviderServices(params: {
  providerId: string;
  categoryId: string;
  selections: ImportSelection[];
  markupType: "fixed" | "percent";
  markupValue: string;
  /** تُنشأ مخفية افتراضيًا ليراجعها الأدمن قبل النشر. */
  publish?: boolean;
}): Promise<{ imported: number; skipped: string[] }> {
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, params.providerId))
    .limit(1);
  if (!provider) throw new AppError("not_found", "المزوّد غير موجود.", 404);

  const { services } = await getProviderCatalog(params.providerId);
  const byId = new Map(services.map((s) => [s.externalId, s]));

  // خدمات مستوردة سابقًا لهذا المزوّد — لا نكررها.
  const existingLinks = await db
    .select({ externalProductId: providerProducts.externalProductId })
    .from(providerProducts)
    .where(eq(providerProducts.providerId, params.providerId));
  const already = new Set(existingLinks.map((l) => l.externalProductId));

  const skipped: string[] = [];
  let imported = 0;

  for (const sel of params.selections) {
    const svc = byId.get(sel.externalId);
    if (!svc) {
      skipped.push(`${sel.externalId}: غير موجود في كتالوج المزوّد`);
      continue;
    }
    if (already.has(sel.externalId)) {
      skipped.push(`${svc.name}: مستوردة مسبقًا`);
      continue;
    }

    const rate = parseAmount(svc.ratePer1000);
    if (rate <= 0n) {
      skipped.push(`${svc.name}: سعر المزوّد غير صالح`);
      continue;
    }
    const salePer1000 = applyMarkup(
      rate,
      params.markupType,
      params.markupValue,
    );
    // ترجمة الاسم والوصف للعربية (اسم مختصر مفهوم + وصف بالمواصفات).
    // اسم مخصّص من الأدمن يُحترم كما هو.
    const translated = translateServiceName(svc.name, svc.category);
    const name = (sel.name?.trim() || translated.name).slice(0, 120);
    const description = translated.description;
    const slug = await uniqueSlug(name);

    try {
      await db.transaction(async (tx) => {
        // حجز الربط أولًا — الفهرس الفريد (providerId, externalProductId)
        // يرفض أي تكرار متزامن فتنهار المعاملة قبل إنشاء منتج يتيم.
        const [product] = await tx
          .insert(products)
          .values({
            categoryId: params.categoryId,
            name,
            slug,
            description,
            type: "quantity",
            fulfillment: "automatic",
            status: params.publish ? "active" : "hidden",
            requiredFields: [
              { key: "link", label: "الرابط", type: "url", required: true },
            ],
          })
          .returning();

        await tx.insert(providerProducts).values({
          providerId: params.providerId,
          productId: product.id,
          externalProductId: svc.externalId,
          externalPrice: toDbAmount(rate),
          markupType: params.markupType,
          markupValue: params.markupValue,
          autoSyncPrice: true,
          lastSyncedAt: new Date(),
        });

        await tx.insert(productQuantityConfig).values({
          productId: product.id,
          unit: "وحدة",
          minQty: svc.minQty ?? "1",
          maxQty: svc.maxQty ?? null,
          pricePer1000: toDbAmount(salePer1000),
          // التكلفة لكل وحدة = سعر المزوّد لكل 1000 ÷ 1000
          costPrice: toDbAmount(per1000ToUnit(rate)),
        });
      });
    } catch (e) {
      // تكرار متزامن التقطه الفهرس الفريد — نتخطاه بهدوء.
      if (e && typeof e === "object" && (e as { code?: string }).code === "23505") {
        skipped.push(`${svc.name}: مستوردة مسبقًا`);
        continue;
      }
      throw e;
    }

    already.add(sel.externalId);
    imported++;
  }

  return { imported, skipped };
}

/**
 * مزامنة أسعار المزوّد: يعيد جلب الكتالوج ويحدّث أسعار البيع للمنتجات
 * المرتبطة التي فُعّلت لها المزامنة. تُستدعى من الكرون ومن زر يدوي.
 */
export async function syncProviderPrices(providerId: string): Promise<{
  checked: number;
  updated: number;
  changes: Array<{ product: string; from: string; to: string }>;
}> {
  const { services } = await getProviderCatalog(providerId, { refresh: true });
  const byId = new Map(services.map((s) => [s.externalId, s]));

  const links = await db
    .select({
      link: providerProducts,
      productName: products.name,
    })
    .from(providerProducts)
    .innerJoin(products, eq(products.id, providerProducts.productId))
    .where(
      and(
        eq(providerProducts.providerId, providerId),
        eq(providerProducts.autoSyncPrice, true),
      ),
    );

  const changes: Array<{ product: string; from: string; to: string }> = [];
  let updated = 0;

  for (const { link, productName } of links) {
    const svc = byId.get(link.externalProductId);
    if (!svc) continue;
    const newRate = parseAmount(svc.ratePer1000);
    if (newRate <= 0n) continue;

    const oldRate = link.externalPrice ? parseAmount(link.externalPrice) : null;
    if (oldRate !== null && oldRate === newRate) continue; // لا تغيّر

    const newSale = applyMarkup(newRate, link.markupType, link.markupValue);

    const [cfg] = await db
      .select()
      .from(productQuantityConfig)
      .where(eq(productQuantityConfig.productId, link.productId))
      .limit(1);

    await db.transaction(async (tx) => {
      if (cfg) {
        await tx
          .update(productQuantityConfig)
          .set({
            pricePer1000: toDbAmount(newSale),
            costPrice: toDbAmount(per1000ToUnit(newRate)),
            updatedAt: new Date(),
          })
          .where(eq(productQuantityConfig.id, cfg.id));
      }
      await tx
        .update(providerProducts)
        .set({ externalPrice: toDbAmount(newRate), lastSyncedAt: new Date() })
        .where(eq(providerProducts.id, link.id));
    });

    changes.push({
      product: productName,
      from: cfg?.pricePer1000 ? displayAmount(cfg.pricePer1000) : "—",
      to: displayAmount(newSale),
    });
    updated++;
  }

  return { checked: links.length, updated, changes };
}

/** مزامنة أسعار كل المزوّدين النشطين (للكرون). */
export async function syncAllProviderPrices(): Promise<{
  providers: number;
  updated: number;
}> {
  const active = await db
    .select({ id: providers.id })
    .from(providers)
    .where(eq(providers.status, "active"));

  let updated = 0;
  for (const p of active) {
    try {
      const r = await syncProviderPrices(p.id);
      updated += r.updated;
    } catch {
      // مزوّد متعثّر لا يوقف الباقي — تُعاد المحاولة في الدورة التالية.
    } finally {
      // نحرّر كتالوج هذا المزوّد فورًا كي لا تتراكم الذاكرة عبر المزوّدين.
      evictCatalog(p.id);
    }
  }
  return { providers: active.length, updated };
}
