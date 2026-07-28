import { z } from "zod";
import { nonNegAmountField } from "./catalog";

export const providerSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جدًا").max(80),
  baseUrl: z
    .string()
    .trim()
    .url("رابط الـ API غير صالح")
    .max(300),
  adapter: z.string().trim().min(1, "اختر نوع المحوّل"),
  markupType: z.enum(["fixed", "percent"]),
  markupValue: nonNegAmountField.default("0"),
  status: z.enum(["active", "paused"]),
  // أسرار المزوّد — تُترك فارغة عند التعديل للإبقاء على القيمة الحالية
  credentials: z.record(z.string(), z.string()).default({}),
  config: z.record(z.string(), z.unknown()).default({}),
});

export type ProviderFormInput = z.infer<typeof providerSchema>;

export const linkProductSchema = z.object({
  productId: z.string().uuid("اختر منتجًا"),
  externalProductId: z
    .string()
    .trim()
    .min(1, "معرّف المنتج لدى المزوّد مطلوب")
    .max(120),
  externalPrice: z
    .string()
    .trim()
    .refine((v) => !v || /^\d+(?:\.\d{1,4})?$/.test(v), "صيغة المبلغ غير صالحة")
    .optional()
    .or(z.literal(""))
    .nullable(),
});

export type LinkProductInput = z.infer<typeof linkProductSchema>;
