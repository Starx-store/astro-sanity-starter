import Link from "next/link";
import { ArrowRight, ArrowLeft, FileText, ShieldCheck, CreditCard } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/server/locale";
import { getSetting } from "@/server/settings/service";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    title: "الشروط والأحكام وطرق الدفع",
    updatedAt: "آخر تحديث: يوليو 2026",
    backToHome: "العودة للرئيسية",
    subtitle: "يرجى قراءة شروط وأحكام استخدام متجر Evo Store وطرق الدفع المعتمدة بعناية قبل استخدام خدماتنا.",
    sections: [
      {
        title: "١. مقدمة",
        content:
          "باستخدامك موقع Evo Store، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء منها، يرجى عدم استخدام الموقع.",
      },
      {
        title: "٢. طبيعة الخدمة",
        content:
          "Evo Store منصة لبيع المنتجات والخدمات الرقمية (اشتراكات، شحن ألعاب، خدمات تواصل اجتماعي، بطاقات وأرصدة رقمية) عبر محفظة داخلية يشحنها العميل مسبقًا.",
      },
      {
        title: "٣. طرق الدفع وتعبئة المحفظة المعتمدة",
        content:
          "يوفر متجر Evo Store عدة وسائل دفع آمنة لتعبئة محفظتك واقتناء الخدمات:\n• التحويل البنكي المباشر (عبر الحسابات البنكية الموضحة في صفحة المحفظة).\n• الدفع السريع التلقائي عبر Binance Pay (USDT/Crypto).\n• الدفع بالعملات الرقمية المباشرة على شبكة BEP20 (USDT / USDC / BUSD).\n• الشحن المباشر عبر التواصل مع الإدارة أو الدعم الفني.",
      },
      {
        title: "٤. المحفظة وسجل الحركات المالية",
        content:
          "جميع عمليات تعبئة الرصيد والشراء تُسجَّل كحركات مالية دائمة في دفتر المحفظة الإلحاقي، ولا يمكن تعديلها أو حذفها للحفاظ على الأمان والشفافية المالية.",
      },
      {
        title: "٥. الطلبات والتسعير",
        content:
          "جميع الأسعار المعروضة تقديرية وتُحسب نهائيًا من قِبل الخادم لحظة تأكيد الطلب. بمجرد تأكيد الطلب يُحجز المبلغ من رصيد المحفظة المتاح حتى اكتمال التنفيذ أو إلغاء الطلب.",
      },
      {
        title: "٦. الاسترجاع والإلغاء",
        content:
          "يمكن للعميل إلغاء الطلب طالما لم يبدأ تنفيذه. في حال فشل تنفيذ الطلب من جهة Evo Store أو مزوّد الخدمة، يُسترجع المبلغ المحجوز تلقائيًا إلى رصيد المحفظة المتاح. لا تُقبل طلبات الاسترجاع بعد اكتمال تنفيذ الطلب بنجاح، إلا في حالات الخطأ التقني المثبت.",
      },
      {
        title: "٧. مسؤولية العميل",
        content:
          "يتحمّل العميل مسؤولية صحة البيانات المُدخلة عند إنشاء الطلب (مثل روابط الحسابات أو معلومات التسليم). لا تتحمّل Evo Store مسؤولية أي خطأ ناتج عن بيانات غير صحيحة أدخلها العميل.",
      },
      {
        title: "٨. تعديل الشروط وطرق الدفع",
        content:
          "تحتفظ Evo Store بحق تعديل هذه الشروط أو إضافة/إيقاف وسائل دفع جديدة في أي وقت، ويُعتبر استمرار استخدامك للموقع موافقة ضمنية.",
      },
      {
        title: "٩. التواصل والدعم الفني",
        content:
          "لأي استفسارات حول الشروط أو المشتريات، يمكنك التواصل معنا عبر نظام التذاكر في المتجر أو عبر واتساب الدعم الفني المباشر.",
      },
    ],
  },
  en: {
    title: "Terms & Conditions & Payment Methods",
    updatedAt: "Last updated: July 2026",
    backToHome: "Back to home",
    subtitle: "Please read terms and conditions carefully before using our services.",
    sections: [
      {
        title: "1. Introduction",
        content: "By using Evo Store, you agree to comply with these terms.",
      },
      {
        title: "2. Nature of Service",
        content: "Evo Store provides digital products and services via internal wallet.",
      },
      {
        title: "3. Payment Methods",
        content: "We accept Bank Transfer, Binance Pay, and BEP20 Crypto Deposits.",
      },
      {
        title: "4. Wallet System",
        content: "All transactions are append-only and audited.",
      },
      {
        title: "5. Orders & Pricing",
        content: "Final prices are calculated on server side upon checkout.",
      },
      {
        title: "6. Refund Policy",
        content: "Refunds are processed automatically if order fails before delivery.",
      },
    ],
  },
} as const;

import { DEFAULT_TERMS_AR, DEFAULT_TERMS_EN } from "@/server/legal/defaults";

export default async function TermsPage() {
  const locale = await getLocale();
  const t = T[locale];
  const isRtl = locale === "ar";
  const ArrowIcon = isRtl ? ArrowRight : ArrowLeft;

  const customTermsAr = await getSetting<string>("legal.terms_ar", "");
  const customTermsEn = await getSetting<string>("legal.terms_en", "");
  const termsText = (isRtl ? customTermsAr : customTermsEn) || (isRtl ? DEFAULT_TERMS_AR : DEFAULT_TERMS_EN);

  return (
    <div className="flex min-h-screen flex-col bg-bg font-sans text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="mb-8 flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-muted hover:text-foreground">
                <ArrowIcon className="h-4 w-4" />
                {t.backToHome}
              </Button>
            </Link>
            <Badge tone="gold" className="px-3 py-1 text-xs">
              {t.updatedAt}
            </Badge>
          </div>

          <div className="mb-10 space-y-3 text-center sm:text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1 text-xs font-bold text-gold">
              <FileText className="h-4 w-4" />
              <span>اتفاقية الاستخدام والخدمة</span>
            </div>
            <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">{t.title}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              {t.subtitle}
            </p>
          </div>

          <Card className="border-border/70 shadow-lg">
            <CardContent className="space-y-8 p-6 sm:p-10">
              <div className="prose max-w-none text-foreground/90 leading-relaxed whitespace-pre-line text-sm sm:text-base">
                {termsText}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
