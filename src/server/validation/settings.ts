import { z } from "zod";
import { AMOUNT_REGEX } from "@/lib/money";

const percent = z.coerce
  .number()
  .min(0, "لا يقل عن 0")
  .max(100, "لا يزيد عن 100")
  .default(0);

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1, "اسم المتجر مطلوب").max(80),
  currency: z.string().trim().min(1).max(8),
  minDeposit: z
    .string()
    .trim()
    .regex(AMOUNT_REGEX, "قيمة غير صالحة"),
  maintenance: z.boolean().default(false),
  // Social & SEO
  "store.whatsapp": z.string().trim().max(50).optional().or(z.literal("")),
  "store.meta_description": z.string().trim().max(300).optional().or(z.literal("")),
  
  // Announcement
  "announcement.enabled": z.boolean().default(false),
  "announcement.text_ar": z.string().max(200).optional().or(z.literal("")),
  "announcement.text_en": z.string().max(200).optional().or(z.literal("")),
  "announcement.link": z.string().max(200).optional().or(z.literal("")),
  "announcement.badge": z.string().max(50).optional().or(z.literal("")),
  // خصومات فئات العضوية (٪) — تُطبّق تلقائيًا على أسعار الطلبات.
  silverDiscount: percent,
  goldDiscount: percent,
  platinumDiscount: percent,
  // أسعار صرف عملات العرض (كم وحدة مقابل 1$) — 0 أو فارغ = معطّلة.
  sarRate: z.coerce.number().min(0).max(1_000_000).default(0),
  yersRate: z.coerce.number().min(0).max(1_000_000).default(0),
  yeroRate: z.coerce.number().min(0).max(1_000_000).default(0),
  // محفظة استقبال العملات الرقمية (BEP20) — فارغة = الميزة معطّلة.
  bep20Address: z
    .string()
    .trim()
    .regex(/^(0x[0-9a-fA-F]{40})?$/, "عنوان محفظة BEP20 غير صالح")
    .default(""),
  cryptoMinConfirmations: z.coerce.number().int().min(1).max(50).default(6),
  // شعار المتجر: صورة مضمّنة (data URL) يرفعها الأدمن — فارغ = الشعار الافتراضي.
  logo: z
    .string()
    .trim()
    // ‏300KB خام تصير ~410k حرفًا بعد base64 — السقف أعلى بهامش كي يتطابق
    // فعليًا مع حد الواجهة (300KB) بدل رفض ملفات 293-300KB.
    .max(450_000, "الشعار كبير جدًا — الحد الأقصى 300KB")
    .regex(
      /^(data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+)?$/,
      "صيغة الشعار غير صالحة",
    )
    .default(""),
  // رقم واتساب الدعم (أرقام فقط مع رمز الدولة) — فارغ = إخفاء الزر.
  supportWhatsapp: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, "رقم واتساب غير صالح (أرقام فقط مع رمز الدولة)")
    .or(z.literal(""))
    .default(""),
  traderReferralCode: z
    .string()
    .trim()
    .max(20, "كود الإحالة طويل جداً")
    .optional()
    .or(z.literal("")),
  // إتاحة التسجيل والدخول
  "auth.register_phone_required": z.boolean().default(true),
  "auth.allow_registration": z.boolean().default(true),
  "admin.fallback_email": z.string().trim().max(100).optional().or(z.literal("")),
  "whatsapp.api_url": z.string().trim().max(200).optional().or(z.literal("")),
  "whatsapp.api_token": z.string().trim().max(200).optional().or(z.literal("")),

  // الشروط والأحكام وسياسة الخصوصية
  "legal.terms_ar": z.string().optional().or(z.literal("")),
  "legal.terms_en": z.string().optional().or(z.literal("")),
  "legal.privacy_ar": z.string().optional().or(z.literal("")),
  "legal.privacy_en": z.string().optional().or(z.literal("")),

  // التحكم في تفعيل وإيقاف الصفحات والميزات
  "feature.news_enabled": z.boolean().default(true),
  "feature.support_enabled": z.boolean().default(true),
  "feature.referrals_enabled": z.boolean().default(true),
  "feature.wallet_enabled": z.boolean().default(true),
  "feature.how_it_works_enabled": z.boolean().default(true),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
