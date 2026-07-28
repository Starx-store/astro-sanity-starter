import Link from "next/link";
import { ArrowRight, ArrowLeft, FileText, ShieldCheck, CreditCard } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/server/locale";

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
          "لأي استفسار بخصوص طرق الدفع أو الشروط، يمكنك التواصل معنا عبر صفحة الدعم الفني أو محادثة واتساب المباشرة.",
      },
    ],
  },
  en: {
    title: "Terms, Conditions & Payment Methods",
    updatedAt: "Last updated: July 2026",
    backToHome: "Back to Home",
    subtitle: "Please read the terms, conditions, and accepted payment methods of Evo Store carefully before using our services.",
    sections: [
      {
        title: "1. Introduction",
        content:
          "By using Evo Store, you agree to be bound by these terms and conditions. If you do not agree to any part of them, please do not use the website.",
      },
      {
        title: "2. Nature of Service",
        content:
          "Evo Store is a platform for selling digital products and services (subscriptions, game top-ups, social media services, cards & credits) via a built-in wallet pre-funded by the customer.",
      },
      {
        title: "3. Accepted Payment & Top-up Methods",
        content:
          "Evo Store supports multiple secure payment methods to top up your wallet:\n• Direct Bank Transfers (to official accounts listed in your Wallet page).\n• Instant automated payments via Binance Pay (USDT/Crypto).\n• Direct Cryptocurrency deposits on the BEP20 network (USDT / USDC / BUSD).\n• Direct manual top-ups via Admin & Customer Support.",
      },
      {
        title: "4. Wallet Ledger & Security",
        content:
          "All top-up and purchase operations are permanently logged on an immutable ledger and cannot be deleted or modified, guaranteeing maximum financial security.",
      },
      {
        title: "5. Orders & Pricing",
        content:
          "All displayed prices are estimates; final prices are calculated by the server upon order confirmation. Upon confirmation, the amount is held from your available wallet balance until completion or cancellation.",
      },
      {
        title: "6. Refunds & Cancellations",
        content:
          "Orders can be cancelled before execution begins. If execution fails from Evo Store or the provider, held funds are automatically released back to your available balance. No refunds are accepted after successful order completion unless a technical glitch is proven.",
      },
      {
        title: "7. Customer Responsibility",
        content:
          "The customer is responsible for the accuracy of input data (such as account links or delivery info). Evo Store bears no responsibility for errors caused by incorrect customer input.",
      },
      {
        title: "8. Amendments",
        content:
          "Evo Store reserves the right to amend these terms or update available payment methods at any time.",
      },
      {
        title: "9. Support & Contact",
        content:
          "For any inquiries regarding payment methods or terms, please reach out via our Support page or direct WhatsApp chat.",
      },
    ],
  },
} as const;

export default async function TermsPage() {
  const locale = await getLocale();
  const t = T[locale];
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        {/* Header Navigation */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/">
            <Button size="sm" variant="ghost">
              <BackIcon className="h-4 w-4" />
              {t.backToHome}
            </Button>
          </Link>
          <Badge tone="gold" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.updatedAt}
          </Badge>
        </div>

        {/* Page Title & Banner */}
        <div className="mb-8 rounded-xl border border-gold/30 bg-surface/50 p-8 text-center sm:text-right">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
              <CreditCard className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{t.title}</h1>
              <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Terms Sections */}
        <Card>
          <CardContent className="divide-y divide-border p-6 sm:p-8">
            {t.sections.map((s, i) => (
              <div key={i} className="py-6 first:pt-0 last:pb-0 space-y-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gold" />
                  {s.title}
                </h2>
                <div className="text-sm leading-relaxed text-muted leading-7 whitespace-pre-line">
                  {s.content}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
