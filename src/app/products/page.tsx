import Link from "next/link";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { Package } from "lucide-react";
import { db } from "@/server/db";
import {
  categories,
  products,
  productPackages,
  productQuantityConfig,
} from "@/server/db/schema";
import { displayAmount, parseAmount, per1000ToUnit } from "@/lib/money";
import { getSelectedCurrency, convertDisplay } from "@/server/currency";
import { getSessionUser } from "@/server/auth/session";
import { getLocale } from "@/server/locale";
import { productStatusLabel } from "@/lib/labels";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    title: "المنتجات",
    subtitle: "اختر منتجًا وادفع من رصيد محفظتك مباشرة.",
    all: "الكل",
    empty: "لا توجد منتجات في هذا التصنيف بعد.",
    from: "يبدأ من",
    details: "اطلع على التفاصيل",
  },
  en: {
    title: "Products",
    subtitle: "Pick a product and pay straight from your wallet balance.",
    all: "All",
    empty: "No products in this category yet.",
    from: "From",
    details: "View details",
  },
} as const;

export default async function ProductsPage(
  props: {
    searchParams: Promise<{ cat?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.isVisible, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const activeCat = searchParams.cat
    ? cats.find((c) => c.slug === searchParams.cat)
    : undefined;
  const currency = await getSelectedCurrency();
  const locale = await getLocale();
  const t = T[locale];
  // منتجات التجار الحصرية تظهر لحسابات التجار فقط.
  const viewer = await getSessionUser();
  const isTrader = viewer?.isTrader ?? false;

  const items = await db
    .select({
      p: products,
      categoryName: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        ne(products.status, "hidden"),
        eq(categories.isVisible, true),
        isTrader ? undefined : eq(products.traderOnly, false),
        activeCat ? eq(products.categoryId, activeCat.id) : undefined,
      ),
    )
    .orderBy(asc(products.sortOrder), asc(products.name));

  // "يبدأ من" — أدنى سعر بكج + أسعار الكمية (مع مراعاة سعر التاجر للتجار)
  const ids = items.map((i) => i.p.id);
  const startPrices = new Map<string, string>();
  if (ids.length > 0) {
    const minPkgs = await db
      .select({
        productId: productPackages.productId,
        min: isTrader
          ? sql<string>`min(COALESCE(${productPackages.traderPrice}, ${productPackages.salePrice}))`
          : sql<string>`min(${productPackages.salePrice})`,
      })
      .from(productPackages)
      .where(
        and(
          inArray(productPackages.productId, ids),
          eq(productPackages.isAvailable, true),
        ),
      )
      .groupBy(productPackages.productId);
    for (const r of minPkgs) startPrices.set(r.productId, r.min);

    const cfgs = await db
      .select()
      .from(productQuantityConfig)
      .where(inArray(productQuantityConfig.productId, ids));
    for (const c of cfgs) {
      const unitPrice = isTrader ? (c.traderPricePerUnit || c.pricePerUnit) : c.pricePerUnit;
      const per1000Price = isTrader ? (c.traderPricePer1000 || c.pricePer1000) : c.pricePer1000;

      const unit = unitPrice
        ? parseAmount(unitPrice)
        : per1000Price
          ? per1000ToUnit(parseAmount(per1000Price))
          : null;
      if (unit !== null && !startPrices.has(c.productId)) {
        startPrices.set(c.productId, displayAmount(unit));
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted">{t.subtitle}</p>
        </div>

        {/* التصنيفات */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link href="/products">
            <Badge
              variant={!activeCat ? "default" : "outline"}
              className="cursor-pointer px-3 py-1.5 text-xs"
            >
              {t.all}
            </Badge>
          </Link>
          {cats.map((c) => (
            <Link key={c.id} href={`/products?cat=${encodeURIComponent(c.slug)}`}>
              <Badge
                variant={activeCat?.id === c.id ? "default" : "outline"}
                className="cursor-pointer px-3 py-1.5 text-xs"
              >
                {c.name}
              </Badge>
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted">
            <Package className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>{t.empty}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ p, categoryName }) => {
              const from = startPrices.get(p.id);
              const st = productStatusLabel(p.status, locale);
              return (
                <Link
                  key={p.id}
                  href={`/products/${encodeURIComponent(p.slug)}`}
                  className="group"
                >
                  <Card className="glass-card-pro card-interactive-pro flex h-full flex-col overflow-hidden rounded-2xl border-white/5">
                    {p.imageId ? (
                      <div className="relative aspect-video w-full overflow-hidden border-b border-border/50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/products/image/${p.imageId}`}
                          alt={p.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                          <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-medium text-white border border-white/10">
                            {categoryName}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-24 w-full bg-gradient-to-br from-gold/10 via-surface-2 to-surface p-4 flex items-center justify-between border-b border-border/50">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold shadow-inner">
                          <Package className="h-5 w-5" />
                        </span>
                        <span className="rounded-full bg-black/40 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-medium text-gold border border-gold/20">
                          {categoryName}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h2 className="font-bold text-base group-hover:text-gold transition-colors line-clamp-1">
                          {p.name}
                        </h2>
                        {p.status !== "active" && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px]",
                              p.status === "out_of_stock" && "bg-destructive/10 text-destructive",
                            )}
                          >
                            {st}
                          </Badge>
                        )}
                      </div>

                      {p.description && (
                        <p className="mb-4 line-clamp-2 text-xs text-muted leading-relaxed">
                          {p.description}
                        </p>
                      )}

                      <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between">
                        {from ? (
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-muted">
                              {t.from}
                            </span>
                            <span className="text-base font-black text-gradient-gold" dir="ltr">
                              ${displayAmount(from)}
                            </span>
                            {currency && (
                              <span className="block text-[10px] text-muted font-semibold" dir="ltr">
                                ≈ {convertDisplay(displayAmount(from), currency)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted">{t.details}</span>
                        )}

                        <span className="text-xs font-bold text-gold group-hover:underline">
                          {t.details} →
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
