import Link from "next/link";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  Wallet,
  ShieldCheck,
  Zap,
  Headphones,
  ArrowLeft,
  Gamepad2,
  Share2,
  CreditCard,
  Package,
} from "lucide-react";
import { db } from "@/server/db";
import {
  categories as categoriesTable,
  products,
  productPackages,
  productQuantityConfig,
} from "@/server/db/schema";
import { displayAmount, parseAmount, per1000ToUnit } from "@/lib/money";
import { getSelectedCurrency, convertDisplay } from "@/server/currency";
import { getSessionUser } from "@/server/auth/session";
import { getLocale } from "@/server/locale";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    heroBadge: "متجر رقمي بمحفظة داخلية",
    heroPre: "كل ما تحتاجه من",
    heroHighlight: "الخدمات الرقمية",
    heroPost: "في مكان واحد",
    heroSub:
      "اشحن محفظتك مرة واحدة، واطلب شحن الألعاب وخدمات التواصل والبطاقات والاشتراكات بسرعة وأمان — مع متابعة كاملة لكل طلب.",
    browseProducts: "تصفّح المنتجات",
    createAccount: "إنشاء حساب",
    productsTitle: "المنتجات",
    productsSub: "اختر منتجًا وادفع من رصيد محفظتك مباشرة.",
    viewAll: "عرض الكل ←",
    emptyTitle: "المنتجات تُضاف قريبًا",
    emptySub: "تصفّح التصنيفات، وسنعلن عن المنتجات فور توفّرها.",
    startsFrom: "يبدأ من",
    seeDetails: "اطلع على التفاصيل",
    whyTitle: "لماذا Evo Store؟",
    whySub: "بُني من الأساس على الأمان المالي وسهولة الاستخدام.",
    howTitle: "كيف يعمل؟",
    howSub: "ثلاث خطوات فقط تفصلك عن طلبك الأول.",
    ctaTitle: "جاهز للبدء؟",
    ctaSub: "أنشئ حسابك مجانًا الآن، واشحن محفظتك، وابدأ الطلب خلال دقائق.",
    ctaButton: "إنشاء حساب مجاني",
    features: [
      {
        title: "محفظة داخلية آمنة",
        desc: "اشحن رصيدك مرة واحدة واطلب أي منتج بضغطة، مع سجل حركات دقيق لكل عملية.",
      },
      {
        title: "حماية مالية صارمة",
        desc: "كل عملية مسجّلة كقيد لا يُعدّل، والأسعار والأرصدة تُحسب من الخادم فقط.",
      },
      {
        title: "تنفيذ فوري",
        desc: "منتجات تُسلّم تلقائيًا فور الدفع، وأخرى بمراجعة يدوية سريعة.",
      },
      {
        title: "دعم متواصل",
        desc: "نظام تذاكر ومراسلة داخل كل طلب لمتابعة حالتك أولًا بأول.",
      },
    ],
    categories: ["شحن الألعاب", "خدمات التواصل", "بطاقات وأرصدة", "اشتراكات رقمية"],
    steps: [
      { n: "١", title: "أنشئ حسابك", desc: "تسجيل سريع بالبريد أو الجوال — يتفعّل فورًا." },
      { n: "٢", title: "اشحن محفظتك", desc: "عبر الإدارة، تحويل يدوي، أو Binance Pay تلقائيًا." },
      { n: "٣", title: "اطلب واستلم", desc: "اختر المنتج، أكّد السعر النهائي، وتابع طلبك حتى التسليم." },
    ],
  },
  en: {
    heroBadge: "A digital store with a built-in wallet",
    heroPre: "All the",
    heroHighlight: "digital services",
    heroPost: "you need in one place",
    heroSub:
      "Top up your wallet once, then order game top-ups, social media services, gift cards, and subscriptions quickly and securely — with full tracking on every order.",
    browseProducts: "Browse products",
    createAccount: "Create account",
    productsTitle: "Products",
    productsSub: "Pick a product and pay straight from your wallet balance.",
    viewAll: "View all →",
    emptyTitle: "Products coming soon",
    emptySub: "Browse the categories — we'll announce products as soon as they're available.",
    startsFrom: "From",
    seeDetails: "View details",
    whyTitle: "Why Evo Store?",
    whySub: "Built from the ground up for financial security and ease of use.",
    howTitle: "How it works",
    howSub: "Just three steps between you and your first order.",
    ctaTitle: "Ready to get started?",
    ctaSub: "Create your free account, top up your wallet, and start ordering within minutes.",
    ctaButton: "Create free account",
    features: [
      {
        title: "Secure built-in wallet",
        desc: "Top up once and order any product in one tap, with a precise transaction log for every operation.",
      },
      {
        title: "Strict financial protection",
        desc: "Every operation is recorded as an immutable ledger entry, and prices and balances are computed on the server only.",
      },
      {
        title: "Instant fulfillment",
        desc: "Some products are delivered automatically right after payment; others after a quick manual review.",
      },
      {
        title: "Always-on support",
        desc: "Tickets and in-order messaging keep you updated every step of the way.",
      },
    ],
    categories: ["Game top-ups", "Social media services", "Cards & credits", "Digital subscriptions"],
    steps: [
      { n: "1", title: "Create your account", desc: "Quick sign-up with email or phone — activated instantly." },
      { n: "2", title: "Top up your wallet", desc: "Through support, manual transfer, or automatic Binance Pay." },
      { n: "3", title: "Order and receive", desc: "Pick a product, confirm the final price, and track your order through delivery." },
    ],
  },
} as const;

const featureIcons = [Wallet, ShieldCheck, Zap, Headphones];
const categoryIcons = [Gamepad2, Share2, CreditCard, Package];

/** أحدث المنتجات المتاحة + أدنى سعر لكل منتج (يبدأ من). */
async function getShowcase(isTrader: boolean) {
  try {
    const items = await db
      .select({ p: products, categoryName: categoriesTable.name })
      .from(products)
      .innerJoin(categoriesTable, eq(products.categoryId, categoriesTable.id))
      .where(
        and(
          ne(products.status, "hidden"),
          eq(categoriesTable.isVisible, true),
          isTrader ? undefined : eq(products.traderOnly, false),
        ),
      )
      .orderBy(asc(products.sortOrder), asc(products.name))
      .limit(8);

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
    return { items, startPrices };
  } catch (err) {
    console.error("Database unavailable or connection error:", err);
    return { items: [], startPrices: new Map<string, string>() };
  }
}

export default async function HomePage() {
  const viewer = await getSessionUser();
  const { items, startPrices } = await getShowcase(viewer?.isTrader ?? false);
  const currency = await getSelectedCurrency();
  const t = T[await getLocale()];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
          <div
            className="absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-gold/10 blur-3xl animate-pulse-glow"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-24 text-center animate-fade-in-up">
            <Badge tone="gold" className="mb-6 animate-float shadow-lg shadow-gold/10">
              {t.heroBadge}
            </Badge>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">
              {t.heroPre}{" "}
              <span className="text-gradient-gold">{t.heroHighlight}</span>{" "}
              {t.heroPost}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
              {t.heroSub}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/products">
                <Button size="lg" className="shadow-lg shadow-gold/20">
                  {t.browseProducts}
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline">
                  {t.createAccount}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {t.categories.map((label, i) => {
              const Icon = categoryIcons[i];
              return (
              <Link key={label} href="/products">
                <Card className="card-interactive group flex h-full flex-col items-center gap-3 p-6 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold/10 text-gold transition-transform duration-300 group-hover:scale-110 group-hover:bg-gold/20">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="font-semibold group-hover:text-gold transition-colors">{label}</span>
                </Card>
              </Link>
              );
            })}
          </div>
        </section>

        {/* Products showcase */}
        <section id="products" className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{t.productsTitle}</h2>
              <p className="mt-2 text-sm text-muted">
                {t.productsSub}
              </p>
            </div>
            <Link
              href="/products"
              className="shrink-0 text-sm font-medium text-gold hover:underline"
            >
              {t.viewAll}
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-gold/10 text-gold">
                <Package className="h-6 w-6" />
              </span>
              <p className="font-semibold">{t.emptyTitle}</p>
              <p className="mt-1 text-sm text-muted">
                {t.emptySub}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map(({ p, categoryName }) => {
                const from = startPrices.get(p.id);
                return (
                  <Link
                    key={p.id}
                    href={`/products/${encodeURIComponent(p.slug)}`}
                  >
                    <Card className="card-interactive group flex h-full flex-col overflow-hidden">
                      {p.imageId ? (
                        <div className="overflow-hidden aspect-video w-full border-b border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/products/image/${p.imageId}`}
                            alt={p.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-1 flex-col p-6">
                      {!p.imageId && (
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold transition-transform duration-300 group-hover:scale-110">
                            <Package className="h-5 w-5" />
                          </span>
                        </div>
                      )}
                      <h3 className="font-bold group-hover:text-gold transition-colors">{p.name}</h3>
                      <p className="mt-1 text-xs text-muted">{categoryName}</p>
                      {p.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted">
                          {p.description}
                        </p>
                      )}
                      <div className="mt-auto pt-4">
                        {from ? (
                          <p className="text-sm text-muted">
                            {t.startsFrom}{" "}
                            <span
                              className="text-lg font-extrabold text-gradient-gold"
                              dir="ltr"
                            >
                              {displayAmount(from)}$
                            </span>
                            {currency && (
                              <span className="mt-0.5 block text-xs" dir="ltr">
                                ≈ {convertDisplay(displayAmount(from), currency)}
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-sm text-muted">{t.seeDetails}</p>
                        )}
                      </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold">{t.whyTitle}</h2>
            <p className="mt-3 text-muted">
              {t.whySub}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.features.map(({ title, desc }, i) => {
              const Icon = featureIcons[i];
              return (
              <Card key={title} className="p-6">
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-gold/10 text-gold">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mb-2 font-bold">{title}</h3>
                <p className="text-sm text-muted">{desc}</p>
              </Card>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-border/60 bg-surface/30">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold">{t.howTitle}</h2>
              <p className="mt-3 text-muted">{t.howSub}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {t.steps.map((s) => (
                <div key={s.n} className="relative">
                  <span className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-gold/40 bg-gold/10 text-xl font-bold text-gold">
                    {s.n}
                  </span>
                  <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
                  <p className="text-sm text-muted">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="support" className="mx-auto max-w-6xl px-4 py-20">
          <Card className="relative overflow-hidden p-10 text-center">
            <div
              className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl"
              aria-hidden
            />
            <div className="relative">
              <h2 className="text-3xl font-bold">{t.ctaTitle}</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted">
                {t.ctaSub}
              </p>
              <div className="mt-8 flex justify-center">
                <Link href="/register">
                  <Button size="lg">
                    {t.ctaButton}
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
