import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { providers } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { getAdapter } from "./adapters";
import { buildContext } from "./service";
import type { ProviderService } from "./adapters/types";

/**
 * كتالوج خدمات المزوّد.
 *
 * لوحات SMM ترجع كل الخدمات (آلاف العناصر، عدة ميجابايت) في نداء واحد لا
 * يقبل تصفية — لذلك نجلبها مرة ونحتفظ بها في ذاكرة العملية لفترة قصيرة،
 * ثم نبحث/نُقسّم صفحاتٍ على الخادم فلا يستقبل المتصفح إلا عشرات العناصر.
 * (بدون ذلك يفشل الاستيراد أو يتجمّد عند المزوّدين كبار الكتالوج.)
 */

const TTL_MS = 10 * 60_000;
// كاش صغير: نحتفظ بكتالوج مزوّد واحد فقط في العملية (الكتالوجات ضخمة —
// عدة ميجابايت — والاحتفاظ بعدة مزوّدين معًا يستنزف ذاكرة الدالة).
const cache = new Map<string, { at: number; services: ProviderService[] }>();
const MAX_CACHE = 1;

/** إزالة كتالوج من الكاش (يُستدعى بعد المزامنة لتحرير الذاكرة). */
export function evictCatalog(providerId: string): void {
  cache.delete(providerId);
}

export async function getProviderCatalog(
  providerId: string,
  opts: { refresh?: boolean } = {},
): Promise<{ services: ProviderService[]; cachedAt: number }> {
  const hit = cache.get(providerId);
  if (!opts.refresh && hit && Date.now() - hit.at < TTL_MS) {
    return { services: hit.services, cachedAt: hit.at };
  }

  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);
  if (!provider) throw new AppError("not_found", "المزوّد غير موجود.", 404);

  const adapter = getAdapter(provider.adapter);
  if (!adapter.getServices) {
    throw new AppError(
      "unsupported",
      "هذا النوع من المزوّدين لا يدعم استيراد الخدمات.",
      409,
    );
  }

  const services = await adapter.getServices(buildContext(provider));
  const at = Date.now();
  // نحرّر كتالوجات المزوّدين الآخرين قبل تخزين الجديد.
  if (cache.size >= MAX_CACHE) {
    for (const key of cache.keys()) {
      if (key !== providerId) cache.delete(key);
    }
  }
  cache.set(providerId, { at, services });
  return { services, cachedAt: at };
}

export interface CatalogQuery {
  q?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  refresh?: boolean;
}

export async function searchProviderCatalog(
  providerId: string,
  query: CatalogQuery,
): Promise<{
  items: ProviderService[];
  total: number;
  totalAll: number;
  page: number;
  pageSize: number;
  categories: string[];
  cachedAt: number;
}> {
  const { services, cachedAt } = await getProviderCatalog(providerId, {
    refresh: query.refresh,
  });

  const q = query.q?.trim().toLowerCase();
  const category = query.category?.trim();
  let filtered = services;
  if (category) {
    filtered = filtered.filter((s) => s.category === category);
  }
  if (q) {
    // بحث بالاسم أو برقم الخدمة مباشرة.
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.externalId.toLowerCase() === q,
    );
  }

  const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 30));
  const page = Math.max(1, query.page ?? 1);
  const start = (page - 1) * pageSize;

  // قائمة التصنيفات تُحسب من الكتالوج كاملًا (لا من نتيجة البحث).
  const categories = Array.from(
    new Set(services.map((s) => s.category).filter((c): c is string => !!c)),
  ).sort();

  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    totalAll: services.length,
    page,
    pageSize,
    categories,
    cachedAt,
  };
}

/** سعر خدمة واحدة لدى المزوّد (من الكتالوج المخزّن مؤقتًا). */
export async function findProviderService(
  providerId: string,
  externalId: string,
): Promise<ProviderService | null> {
  const { services } = await getProviderCatalog(providerId);
  return services.find((s) => s.externalId === externalId) ?? null;
}
