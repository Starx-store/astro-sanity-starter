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

  // "يبدأ من" — أدنى سعر بكج + أسعار الكمية
  const ids = items.map((i) => i.p.id);
  const startPrices = new Map<string, string>();
  if (ids.length > 0) {
    const minPkgs = await db
      .select({
        productId: productPackages.productId,
        min: sql<string>`min(${productPackages.salePrice})`,
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
      const unit = c.pricePerUnit
        ? parseAmount(c.pricePerUnit)
        : c.pricePer1000
          ? per1000ToUnit(parseAmount(c.pricePer1000))
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

        {/* تصفية التصنيفات */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/products"
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              !activeCat
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {t.all}
          </Link>
          {cats.map((c) => (
            <Link
              key={c.id}
              href={`/products?cat=${encodeURIComponent(c.slug)}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                activeCat?.id === c.id
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-border text-muted hover:text-foreground",
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted">
            {t.empty}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ p, categoryName }) => {
              const st = productStatusLabel(p.status, locale);
              const from = startPrices.get(p.id);
              return (
                <Link key={p.id} href={`/products/${encodeURIComponent(p.slug)}`}>
                  <Card className="flex h-full flex-col overflow-hidden transition-colors hover:border-gold/40">
                    {p.imageId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      (<img
                        src={`/api/products/image/${p.imageId}`}
                        alt={p.name}
                        loading="lazy"
                        className="aspect-video w-full border-b border-border object-cover"
                      />)
                    ) : null}
                    <div className="flex flex-1 flex-col p-6">
                    {(!p.imageId || p.status !== "active") && (
                      <div className="mb-4 flex items-start justify-between gap-3">
                        {!p.imageId ? (
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold">
                            <Package className="h-5 w-5" />
                          </span>
                        ) : (
                          <span />
                        )}
                        {p.status !== "active" && (
                          <Badge tone={st.tone}>{st.label}</Badge>
                        )}
                      </div>
                    )}
                    <h3 className="font-bold">{p.name}</h3>
                    <p className="mt-1 text-xs text-muted">{categoryName}</p>
                    {p.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted">
                        {p.description}
                      </p>
                    )}
                    <div className="mt-auto pt-4">
                      {from ? (
                        <p className="text-sm text-muted">
                          {t.from}{" "}
                          <span className="text-lg font-extrabold text-gradient-gold" dir="ltr">
                            {displayAmount(from)}$
                          </span>
                          {currency && (
                            <span className="mt-0.5 block text-xs" dir="ltr">
                              ≈ {convertDisplay(displayAmount(from), currency)}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-muted">{t.details}</p>
                      )}
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
