import Link from "next/link";
import { ArrowRight, ArrowLeft, Lock, ShieldCheck } from "lucide-react";
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
        title: "1. Information We Collect",
        content: "We collect account details, order history, and wallet transactions securely.",
      },
      {
        title: "2. How We Use Information",
        content: "Your data is strictly used for order processing and account management.",
      },
    ],
  },
} as const;

import { DEFAULT_PRIVACY_AR, DEFAULT_PRIVACY_EN } from "@/server/legal/defaults";

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = T[locale];
  const isRtl = locale === "ar";
  const ArrowIcon = isRtl ? ArrowRight : ArrowLeft;

  const customPrivacyAr = await getSetting<string>("legal.privacy_ar", "");
  const customPrivacyEn = await getSetting<string>("legal.privacy_en", "");
  const privacyText = (isRtl ? customPrivacyAr : customPrivacyEn) || (isRtl ? DEFAULT_PRIVACY_AR : DEFAULT_PRIVACY_EN);

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
              <Lock className="h-4 w-4" />
              <span>حماية البيانات والخصوصية</span>
            </div>
            <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">{t.title}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              {t.subtitle}
            </p>
          </div>

          <Card className="border-border/70 shadow-lg">
            <CardContent className="space-y-8 p-6 sm:p-10">
              <div className="prose max-w-none text-foreground/90 leading-relaxed whitespace-pre-line text-sm sm:text-base">
                {privacyText}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
