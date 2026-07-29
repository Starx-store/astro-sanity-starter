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
  Crown,
  Bot,
  Sparkles,
  CheckCircle2,
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
    heroBadge: "✨ الجيل الجديد للمتاجر الرقمية",
    heroPre: "منصة متكاملة لـ",
    heroHighlight: "الخدمات والمنتجات الرقمية",
    heroPost: "بأعلى سرعة وأمان",
    heroSub:
      "اشحن محفظتك مرة واحدة واطلب شحن الألعاب، اشتراكات البث والذكاء الاصطناعي، وخدمات التواصل بضغطة زر — مع متابعة دقيقة وتأكيد فوري لكل طلب.",
    browseProducts: "تصفّح المنتجات الفاخرة",
    createAccount: "أنشئ حسابك مجاناً",
    productsTitle: "أبرز المنتجات والخدمات",
    productsSub: "اختر ما يناسبك واشترِ مباشرة من رصيد محفظتك الآمنة.",
    viewAll: "عرض جميع المنتجات ←",
    emptyTitle: "المنتجات تُضاف قريبًا",
    emptySub: "تصفّح التصنيفات وسنعلن عن المنتجات فور توفّرها.",
    startsFrom: "يبدأ من",
    seeDetails: "تفاصيل المنتج",
    whyTitle: "لماذا يختار الجميع Evo Store؟",
    whySub: "بُني على أحدث معايير الأمان المالي والتنفيذ الفوري السريع.",
    howTitle: "ثلاث خطوات بسيطة للبدء",
    howSub: "تجربة استخدام سلسة مصممة لراحتك.",
    ctaTitle: "جاهز لتجربة رقمية فريدة؟",
    ctaSub: "أنشئ حسابك المجاني خلال 30 ثانية وابدأ طلب خدماتك المفضلة فوراً.",
    ctaButton: "ابدأ الآن مجاناً",
    features: [
      {
        title: "محفظة رقمية ذكية",
        desc: "شحن فوري مرة واحدة لشراء كافة المنتجات بسهولة مع سجل مالي دقيق.",
      },
      {
        title: "حماية مالية مشددة",
        desc: "معالجة آمنة مشفرة للعمليات مع احتساب دقيق للأرصدة من الخادم.",
      },
      {
        title: "تسليم وتسليم فوري",
        desc: "منتجات تُسلّم تلقائياً فور الشراء وأخرى بمتابعة دقيقة على مدار الساعة.",
      },
      {
        title: "دعم فني متواصل 24/7",
        desc: "نظام تذاكر متطور ومساعد ذكي للرد على استفساراتك وتتبع طلباتك.",
      },
    ],
    categories: ["شحن الألعاب", "خدمات التواصل", "بطاقات وأرصدة", "اشتراكات رقمية"],
    steps: [
      { n: "١", title: "أنشئ حسابك", desc: "تسجيل سريع ومباشر بالبريد أو رقم الجوال." },
      { n: "٢", title: "اشحن محفظتك", desc: "خيارات دفع متنوعة وتشمل Binance Pay والتحويلات." },
      { n: "٣", title: "استلم طلبك فوراً", desc: "اختر منتجك وتتبّع خطوات التسليم لحظة بلحظة." },
    ],
  },
  en: {
    heroBadge: "✨ Next-Gen Digital Store",
    heroPre: "All your favourite",
    heroHighlight: "Digital Services",
    heroPost: "in one place",
    heroSub:
      "Top up your wallet once and order game top-ups, AI subscriptions, and social media services in seconds with full order tracking.",
    browseProducts: "Explore Products",
    createAccount: "Create Account",
    productsTitle: "Featured Products",
    productsSub: "Select a product and pay instantly from your secure wallet.",
    viewAll: "View All Products →",
    emptyTitle: "Products coming soon",
    emptySub: "Browse categories — new items are added continuously.",
    startsFrom: "From",
    seeDetails: "View Details",
    whyTitle: "Why Choose Evo Store?",
    whySub: "Built for financial security, speed, and ultimate reliability.",
    howTitle: "Three Simple Steps",
    howSub: "Seamless user experience crafted for your convenience.",
    ctaTitle: "Ready to Start?",
    ctaSub: "Create your free account in 30 seconds and start ordering now.",
    ctaButton: "Get Started Free",
    features: [
      {
        title: "Smart Built-in Wallet",
        desc: "Top up once and buy any service instantly with clean transaction history.",
      },
      {
        title: "Strict Financial Protection",
        desc: "Encrypted operation processing and server-side balance validation.",
      },
      {
        title: "Instant Fulfillment",
        desc: "Automated digital delivery and fast manual processing.",
      },
      {
        title: "24/7 Live Support",
        desc: "Smart assistant and support ticketing inside every order.",
      },
    ],
    categories: ["Game Top-ups", "Social Media", "Gift Cards", "Subscriptions"],
    steps: [
      { n: "1", title: "Create Account", desc: "Instant sign-up with email or mobile number." },
      { n: "2", title: "Top Up Wallet", desc: "Multiple deposit methods including Binance Pay." },
      { n: "3", title: "Instant Delivery", desc: "Select a service and track delivery in real time." },
    ],
  },
} as const;

const featureIcons = [Wallet, ShieldCheck, Zap, Headphones];
const categoryIcons = [Gamepad2, Share2, CreditCard, Package];

/** أحدث المنتجات المتاحة + أدنى سعر لكل منتج */
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
    <div className="flex min-h-screen flex-col bg-bg text-foreground selection:bg-gold/30">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section - Pro Max Style */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
          <div className="bg-grid-pro absolute inset-0 opacity-30" aria-hidden />
          
          {/* Neon Floating Blobs */}
          <div
            className="animate-pulse-glow-pro absolute -top-32 right-1/4 h-[450px] w-[450px] rounded-full bg-gold/15 blur-[100px]"
            aria-hidden
          />
          <div
            className="animate-pulse-glow-pro absolute top-1/3 -left-20 h-[380px] w-[380px] rounded-full bg-blue-500/10 blur-[100px]"
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl px-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-semibold text-gold shadow-lg shadow-gold/10 backdrop-blur-md transition-transform hover:scale-105">
              <Sparkles className="h-4 w-4 animate-spin" />
              <span>{t.heroBadge}</span>
            </div>

            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-black tracking-tight leading-tight sm:text-6xl md:text-7xl">
              {t.heroPre}{" "}
              <span className="text-gradient-gold drop-shadow-sm">{t.heroHighlight}</span>{" "}
              {t.heroPost}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base text-muted sm:text-lg leading-relaxed font-medium">
              {t.heroSub}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/products">
                <Button size="lg" className="h-13 px-8 text-base font-bold bg-gradient-to-r from-amber-500 via-gold to-gold-strong text-gold-foreground shadow-xl shadow-gold/25 hover:shadow-gold/40 transition-all hover:scale-105">
                  {t.browseProducts}
                  <ArrowLeft className="h-5 w-5 rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="h-13 px-8 text-base font-semibold border-border/80 glass-card-pro hover:bg-surface-2 hover:border-gold/50 transition-all">
                  {t.createAccount}
                </Button>
              </Link>
            </div>

            {/* Micro Stats Bar */}
            <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4 rounded-2xl glass-card-pro p-4 sm:p-6 shadow-2xl border border-white/5">
              <div>
                <div className="text-xl sm:text-3xl font-black text-gradient-gold">100%</div>
                <div className="text-xs sm:text-sm text-muted font-medium mt-1">تسليم آمن ومعتمد</div>
              </div>
              <div className="border-x border-border/50">
                <div className="text-xl sm:text-3xl font-black text-gradient-gold">24/7</div>
                <div className="text-xs sm:text-sm text-muted font-medium mt-1">دعم متواصل وحي</div>
              </div>
              <div>
                <div className="text-xl sm:text-3xl font-black text-gradient-gold">فوري</div>
                <div className="text-xs sm:text-sm text-muted font-medium mt-1">معالجة آلية للطلبات</div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section - Pro Max Glass Cards */}
        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {t.categories.map((label, i) => {
              const Icon = categoryIcons[i];
              return (
                <Link key={label} href="/products">
                  <Card className="glass-card-pro card-interactive-pro group flex h-full flex-col items-center gap-3.5 p-6 text-center rounded-2xl border-white/5">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 text-gold shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:bg-gold group-hover:text-gold-foreground">
                      <Icon className="h-7 w-7" />
                    </span>
                    <span className="font-bold text-base group-hover:text-gold transition-colors">{label}</span>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Products Showcase */}
        <section id="products" className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">
                <Sparkles className="h-4 w-4" />
                <span>تصفّح العروض</span>
              </div>
              <h2 className="mt-1 text-2xl font-black sm:text-4xl">{t.productsTitle}</h2>
              <p className="mt-2 text-sm text-muted">
                {t.productsSub}
              </p>
            </div>
            <Link
              href="/products"
              className="shrink-0 text-sm font-bold text-gold hover:underline flex items-center gap-1"
            >
              {t.viewAll}
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="rounded-3xl glass-card-pro p-12 text-center border-dashed border-border/80">
              <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gold/10 text-gold">
                <Package className="h-8 w-8" />
              </span>
              <p className="text-lg font-bold">{t.emptyTitle}</p>
              <p className="mt-1 text-sm text-muted">
                {t.emptySub}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.map(({ p, categoryName }) => {
                const from = startPrices.get(p.id);
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
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white border border-white/10">
                            {categoryName}
                          </div>
                        </div>
                      ) : (
                        <div className="relative h-28 w-full bg-gradient-to-br from-gold/10 via-surface-2 to-surface p-4 flex items-center justify-between border-b border-border/50">
                          <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold/15 text-gold shadow-inner transition-transform group-hover:scale-110">
                            <Package className="h-6 w-6" />
                          </span>
                          <span className="rounded-full bg-black/40 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-gold border border-gold/20">
                            {categoryName}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="text-base font-bold group-hover:text-gold transition-colors line-clamp-1">{p.name}</h3>
                        
                        {p.description && (
                          <p className="mt-2 line-clamp-2 text-xs text-muted leading-relaxed">
                            {p.description}
                          </p>
                        )}

                        <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between">
                          {from ? (
                            <div>
                              <span className="block text-[10px] uppercase font-bold text-muted">{t.startsFrom}</span>
                              <span className="text-lg font-black text-gradient-gold" dir="ltr">
                                ${displayAmount(from)}
                              </span>
                              {currency && (
                                <span className="block text-[10px] text-muted font-semibold" dir="ltr">
                                  ≈ {convertDisplay(displayAmount(from), currency)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-muted">{t.seeDetails}</span>
                          )}

                          <span className="grid h-8 w-8 place-items-center rounded-full bg-gold/10 text-gold transition-transform duration-300 group-hover:bg-gold group-hover:text-gold-foreground group-hover:translate-x-[-2px]">
                            <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Pro Banners: VIP Trader & AI Assistant */}
        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* VIP Trader Banner */}
            <div className="glass-card-gold relative overflow-hidden rounded-3xl p-7 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="relative z-10">
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-bold text-gold border border-gold/40">
                    <Crown className="h-4 w-4" />
                    <span>باقة التجار والـ VIP</span>
                  </div>
                  <h3 className="text-2xl font-black text-foreground">هل أنت صاحب متجر أو موزع؟</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed font-medium">
                    احصل على خصومات حصرية للتجار، وأولوية في المعالجة الآلية لجميع الطلبات لتعزيز أرباحك وتوسيع تجارتك.
                  </p>
                  <div className="mt-6">
                    <Link href="/support">
                      <Button size="sm" className="bg-gold text-gold-foreground font-bold hover:bg-gold-strong shadow-lg shadow-gold/20">
                        طلب انضمام للتجار ←
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Assistant Banner */}
            <div className="glass-card-pro relative overflow-hidden rounded-3xl p-7 shadow-2xl border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-surface to-bg">
              <div className="flex items-start justify-between gap-4">
                <div className="relative z-10">
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/40">
                    <Bot className="h-4 w-4 animate-bounce" />
                    <span>المساعد الآلي الذكي 24/7</span>
                  </div>
                  <h3 className="text-2xl font-black text-foreground">استعلام واستجابة فورية لطلباتك</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed font-medium">
                    تتبع حالة طلبك فورياً ورصيد حسابك في أي وقت عبر المساعد الذكي المتاح بأسفل الشاشة.
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span>المساعد الذكي متصل ومتاح الآن في الزاوية السفلى</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Showcase */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black sm:text-4xl">{t.whyTitle}</h2>
            <p className="mt-3 text-base text-muted font-medium max-w-xl mx-auto">
              {t.whySub}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.features.map(({ title, desc }, i) => {
              const Icon = featureIcons[i];
              return (
                <Card key={title} className="glass-card-pro p-6 rounded-2xl border-white/5 transition-all hover:border-gold/40">
                  <span className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 text-gold shadow-inner">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mb-2 text-lg font-bold">{title}</h3>
                  <p className="text-xs text-muted leading-relaxed font-medium">{desc}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-border/40 bg-surface/20 relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-black sm:text-4xl">{t.howTitle}</h2>
              <p className="mt-3 text-base text-muted font-medium">{t.howSub}</p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-3">
              {t.steps.map((s) => (
                <div key={s.n} className="glass-card-pro relative p-8 rounded-3xl border-white/5 text-center">
                  <span className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-gold to-gold-strong text-2xl font-black text-gold-foreground shadow-lg shadow-gold/20">
                    {s.n}
                  </span>
                  <h3 className="mb-3 text-xl font-bold">{s.title}</h3>
                  <p className="text-xs text-muted font-medium leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="support" className="mx-auto max-w-6xl px-4 py-20">
          <Card className="glass-card-gold relative overflow-hidden p-10 sm:p-16 text-center rounded-3xl border-gold/30 shadow-2xl">
            <div
              className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-gold/15 blur-3xl animate-pulse-glow-pro"
              aria-hidden
            />
            <div className="relative z-10">
              <h2 className="text-3xl font-black sm:text-5xl">{t.ctaTitle}</h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-muted font-medium leading-relaxed">
                {t.ctaSub}
              </p>
              <div className="mt-8 flex justify-center">
                <Link href="/register">
                  <Button size="lg" className="h-13 px-8 text-base font-bold bg-gold text-gold-foreground hover:bg-gold-strong shadow-xl shadow-gold/30 transition-transform hover:scale-105">
                    {t.ctaButton}
                    <ArrowLeft className="h-5 w-5 rtl:rotate-0 ltr:rotate-180" />
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
