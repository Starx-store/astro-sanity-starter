import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Clock, ShieldCheck, Info } from "lucide-react";
import { z } from "zod";
import { db } from "@/server/db";
import {
  products,
  categories,
  productPackages,
  productQuantityConfig,
  priceTiers,
  customerPrices,
  wallets,
} from "@/server/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { getSelectedCurrency } from "@/server/currency";
import { getLocale } from "@/server/locale";
import { requiredFieldDefSchema } from "@/server/validation/catalog";
import { displayAmount, parseAmount } from "@/lib/money";
import { productStatusLabel } from "@/lib/labels";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderBox } from "@/components/store/order-box";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    execTime: "مدة التنفيذ المتوقعة",
    warranty: "الضمان",
    terms: "الشروط والتنبيهات",
    orderNow: "اطلب الآن",
  },
  en: {
    execTime: "Estimated delivery time",
    warranty: "Warranty",
    terms: "Terms & Notes",
    orderNow: "Order Now",
  },
} as const;

export default async function ProductPage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  let slug = params.slug;
  try {
    slug = decodeURIComponent(params.slug);
  } catch {
    /* تجاهل */
  }

  const [row] = await db
    .select({ p: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.slug, slug))
    .limit(1);

  if (!row || row.p.status === "hidden") notFound();
  // منتج حصري للتجار: غير موجود من منظور بقية العملاء.
  if (row.p.traderOnly) {
    const viewer = await getSessionUser();
    if (!viewer?.isTrader) notFound();
  }
  const product = row.p;

  const pkgs =
    product.type === "package"
      ? await db
          .select()
          .from(productPackages)
          .where(
            and(
              eq(productPackages.productId, product.id),
              eq(productPackages.isAvailable, true),
            ),
          )
          .orderBy(asc(productPackages.sortOrder), asc(productPackages.name))
      : [];

  const [qtyCfg] =
    product.type === "quantity"
      ? await db
          .select()
          .from(productQuantityConfig)
          .where(eq(productQuantityConfig.productId, product.id))
          .limit(1)
      : [];

  const tiers =
    product.type === "quantity"
      ? await db
          .select()
          .from(priceTiers)
          .where(eq(priceTiers.productId, product.id))
          .orderBy(asc(priceTiers.minQty))
      : [];

  const user = await getSessionUser();
  let available: string | null = null;
  if (user) {
    const [w] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, user.id))
      .limit(1);
    if (w) {
      available = displayAmount(parseAmount(w.balance) - parseAmount(w.heldBalance));
    }
  }

  const defs = z.array(requiredFieldDefSchema).safeParse(product.requiredFields);
  const requiredFields = defs.success ? defs.data : [];
  const locale = await getLocale();
  const t = T[locale];
  const st = productStatusLabel(product.status, locale);

  const currency = await getSelectedCurrency();

  // أسعار خاصة بهذا العميل (أعلى أولوية — تُعرض كما ستُحاسَب تمامًا).
  const myPrices = user
    ? await db
        .select()
        .from(customerPrices)
        .where(
          and(
            eq(customerPrices.userId, user.id),
            eq(customerPrices.productId, product.id),
          ),
        )
    : [];
  const customQtyPrice = myPrices.find((c) => c.packageId === null);

  // باقة التاجر: يُعرض له سعره الفعلي (نفس ما سيُحاسَب به الخادم تمامًا).
  const isTrader = user?.isTrader ?? false;
  const traderHasQtyPrice =
    isTrader &&
    !!qtyCfg &&
    (!!qtyCfg.traderPricePerUnit || !!qtyCfg.traderPricePer1000);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* التفاصيل */}
          <div className="space-y-6 lg:col-span-3">
            {product.imageId && (
              // eslint-disable-next-line @next/next/no-img-element
              (<img
                src={`/api/products/image/${product.imageId}`}
                alt={product.name}
                className="aspect-video w-full rounded-xl border border-border object-cover"
              />)
            )}
            <div>
              <p className="text-sm text-muted">{row.categoryName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-extrabold">{product.name}</h1>
                {product.status !== "active" && (
                  <Badge tone={st.tone}>{st.label}</Badge>
                )}
              </div>
            </div>

            {product.description && (
              <p className="whitespace-pre-line leading-relaxed text-muted">
                {product.description}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {product.executionTime && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
                  <Clock className="h-5 w-5 shrink-0 text-gold" />
                  <div>
                    <p className="text-xs text-muted">{t.execTime}</p>
                    <p className="text-sm font-semibold">{product.executionTime}</p>
                  </div>
                </div>
              )}
              {product.warranty && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-gold" />
                  <div>
                    <p className="text-xs text-muted">{t.warranty}</p>
                    <p className="text-sm font-semibold">{product.warranty}</p>
                  </div>
                </div>
              )}
            </div>

            {product.terms && (
              <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <Info className="h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="mb-1 text-sm font-semibold">{t.terms}</p>
                  <p className="whitespace-pre-line text-sm text-muted">
                    {product.terms}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* صندوق الطلب */}
          <div className="lg:col-span-2">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base">{t.orderNow}</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderBox
                  productId={product.id}
                  productName={product.name}
                  productType={product.type}
                  orderable={product.status === "active"}
                  packages={pkgs.map((p) => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    salePrice:
                      myPrices.find((c) => c.packageId === p.id)?.price ??
                      (isTrader && p.traderPrice ? p.traderPrice : p.salePrice),
                    packageType: (p.packageType as "fixed" | "quantity") ?? "fixed",
                    pricePer1000: isTrader && p.traderPricePer1000 ? p.traderPricePer1000 : p.pricePer1000,
                    minQty: p.minQty ? displayAmount(p.minQty) : "1",
                    maxQty: p.maxQty ? displayAmount(p.maxQty) : null,
                  }))}
                  qty={
                    qtyCfg
                      ? {
                          unit: qtyCfg.unit,
                          minQty: displayAmount(qtyCfg.minQty),
                          maxQty: qtyCfg.maxQty ? displayAmount(qtyCfg.maxQty) : null,
                          // ترتيب الأولوية كما في الخادم: سعر العميل الخاص،
                          // ثم سعر التاجر، ثم السعر العادي وشرائحه.
                          pricePerUnit: customQtyPrice
                            ? null
                            : traderHasQtyPrice
                              ? qtyCfg.traderPricePerUnit
                              : qtyCfg.pricePerUnit,
                          pricePer1000: customQtyPrice
                            ? customQtyPrice.price
                            : traderHasQtyPrice
                              ? qtyCfg.traderPricePer1000
                              : qtyCfg.pricePer1000,
                          tiers:
                            customQtyPrice || traderHasQtyPrice
                              ? []
                              : tiers.map((t) => ({
                                  minQty: t.minQty,
                                  maxQty: t.maxQty,
                                  pricePerUnit: t.pricePerUnit,
                                })),
                        }
                      : null
                  }
                  requiredFields={requiredFields}
                  isLoggedIn={!!user}
                  availableBalance={available}
                  loginNext={`/products/${encodeURIComponent(product.slug)}`}
                  currency={
                    currency
                      ? { label: currency.label, rate: currency.rate }
                      : null
                  }
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
