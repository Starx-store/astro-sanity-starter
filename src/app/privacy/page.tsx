import Link from "next/link";
import { ArrowRight, ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/server/locale";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    title: "سياسة الخصوصية",
    updatedAt: "آخر تحديث: يوليو 2026",
    backToHome: "العودة للرئيسية",
    subtitle: "نحن نلتزم بحماية خصوصية بياناتك ومعلوماتك المالية بأعلى معايير الأمان.",
    sections: [
      {
        title: "١. البيانات التي نجمعها",
        content:
          "نجمع البيانات التي تقدّمها عند إنشاء الحساب (الاسم، البريد الإلكتروني، رقم الجوال)، وبيانات الطلبات (تفاصيل المنتج المطلوب)، وسجل حركات المحفظة، بالإضافة إلى بيانات تقنية أساسية (عنوان IP، نوع المتصفح) لأغراض الأمان والحماية.",
      },
      {
        title: "٢. كيفية استخدام البيانات",
        content:
          "تُستخدم بياناتك لتنفيذ طلباتك، إدارة حسابك ومحفظتك، التواصل معك بخصوص حالة الطلبات أو الدعم الفني، وتحسين جودة الخدمة. لا تُستخدم بياناتك لأي غرض تسويقي أو مشاركة دون موافقتك الصريحة.",
      },
      {
        title: "٣. مشاركة البيانات",
        content:
          "لا نبيع أو نشارك بياناتك الشخصية مع أطراف خارجية، باستثناء ما يلزم لتنفيذ الطلب (مثل إرسال بيانات الخدمة المطلوبة للمزوّد الرقمي بشكل مشفّر) أو ما تفرضه الجهات التنظيمية والقانونية.",
      },
      {
        title: "٤. أمان البيانات والحماية المالية",
        content:
          "تُحفظ كلمات المرور مشفّرة بتقنية bcrypt ولا تُخزَّن نصًّا مطلقًا. جميع العمليات المالية مسجّلة في دفتر إلحاقي غير قابل للتعديل. نستخدم اتصالًا مشفّرًا (HTTPS/TLS) لكل التفاعلات مع الموقع، ونوفّر خاصية المصادقة الثنائية (2FA).",
      },
      {
        title: "٥. ملفات تعريف الارتباط (Cookies)",
        content:
          "نستخدم ملفات تعريف ارتباط أساسية للحفاظ على جلسة تسجيل الدخول وأمان الجلسة فقط، ولا نستخدم أي أدوات تتبّع إعلاني أو ملفات تعريف ارتباط من طرف ثالث.",
      },
      {
        title: "٦. حقوقك وإدارة الحساب",
        content:
          "يحق لك في أي وقت الاطلاع على بياناتك المسجلة، طلب تعديلها، أو طلب تعطيل/حذف حسابك بالتواصل معنا عبر نظام الدعم الفني.",
      },
      {
        title: "٧. التواصل بخصوص الخصوصية",
        content:
          "لأي استفسار أو طلب بخصوص سياسة الخصوصية وحماية البيانات، يمكنك التواصل مع فريق الدعم الفني عبر صفحة الدعم بالموقع.",
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updatedAt: "Last updated: July 2026",
    backToHome: "Back to Home",
    subtitle: "We are committed to protecting your personal data and financial privacy with the highest security standards.",
    sections: [
      {
        title: "1. Data We Collect",
        content:
          "We collect account registration data (name, email, phone), order details, wallet transaction logs, and essential technical metadata (IP address, browser type) for security purposes.",
      },
      {
        title: "2. How We Use Data",
        content:
          "Your data is used solely to process orders, manage your wallet, provide customer support, and improve platform reliability. We never use your data for unauthorized marketing.",
      },
      {
        title: "3. Data Sharing",
        content:
          "We do not sell or share your personal data with third parties, except as strictly required to fulfill orders (e.g. sending target payload to fulfillment adapters) or where legally mandated.",
      },
      {
        title: "4. Data Security & Ledger Safety",
        content:
          "Passwords are strictly hashed using bcrypt. All financial records are kept on an append-only immutable ledger. All web traffic is encrypted via HTTPS/TLS, with optional Two-Factor Authentication (2FA).",
      },
      {
        title: "5. Cookies Policy",
        content:
          "We only use essential HTTP-only cookies necessary to maintain authenticated sessions. We do not employ third-party tracking or advertising cookies.",
      },
      {
        title: "6. Your Rights",
        content:
          "You have the right to request access to your personal data, request corrections, or ask for account deletion via our support system at any time.",
      },
      {
        title: "7. Contact Us",
        content:
          "For any privacy or data protection inquiries, please get in touch through our Support page.",
      },
    ],
  },
} as const;

export default async function PrivacyPage() {
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
              <Lock className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{t.title}</h1>
              <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Privacy Sections */}
        <Card>
          <CardContent className="divide-y divide-border p-6 sm:p-8">
            {t.sections.map((s, i) => (
              <div key={i} className="py-6 first:pt-0 last:pb-0 space-y-2">
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gold" />
                  {s.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted leading-7">
                  {s.content}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
