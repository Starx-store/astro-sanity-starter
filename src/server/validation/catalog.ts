import { z } from "zod";
import { AMOUNT_REGEX, QTY_REGEX } from "@/lib/money";

/** معرّف slug: حروف لاتينية صغيرة/عربية/أرقام مفصولة بشرطات. */
const SLUG_REGEX = /^[a-z0-9؀-ۿ]+(?:-[a-z0-9؀-ۿ]+)*$/;

const slugField = z
  .string()
  .trim()
  .min(1, "المعرّف (slug) مطلوب")
  .max(80, "المعرّف طويل جدًا")
  .regex(SLUG_REGEX, "معرّف غير صالح — حروف/أرقام وشرطات فقط");

/** مبلغ غير سالب (يسمح بـ 0 — للتكلفة). */
export const nonNegAmountField = z
  .string()
  .trim()
  .regex(AMOUNT_REGEX, "صيغة المبلغ غير صالحة");

/** مبلغ موجب (> 0). */
export const posAmountField = nonNegAmountField.refine(
  (v) => Number(v) > 0,
  "يجب أن يكون المبلغ أكبر من صفر",
);

const qtyField = z
  .string()
  .trim()
  .regex(QTY_REGEX, "كمية غير صالحة (حتى 4 كسور)");

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

/* ------------------------------------------------------------------ */
/*  التصنيفات                                                          */
/* ------------------------------------------------------------------ */

export const categorySchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جدًا").max(80),
  slug: slugField,
  icon: optionalText(40),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isVisible: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;

/* ------------------------------------------------------------------ */
/*  المنتجات                                                           */
/* ------------------------------------------------------------------ */

export const requiredFieldDefSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,39}$/, "المفتاح: لاتيني صغير يبدأ بحرف (a-z, 0-9, _)"),
  label: z.string().trim().min(1, "تسمية الحقل مطلوبة").max(80),
  type: z.enum(["text", "textarea", "url", "email", "number"]),
  required: z.boolean().default(true),
});

export type RequiredFieldDef = z.infer<typeof requiredFieldDefSchema>;

const optionalUuid = z
  .string()
  .trim()
  .refine(
    (v) => !v || /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v),
    "معرّف غير صالح",
  )
  .optional()
  .or(z.literal(""))
  .nullable();

export const packageRowSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1, "اسم البكج مطلوب").max(120),
  description: optionalText(500),
  salePrice: posAmountField,
  // السعر الخاص بباقة التاجر (اختياري) — سعر مستقل وليس خصمًا.
  traderPrice: posAmountField.optional().or(z.literal("")),
  costPrice: nonNegAmountField.default("0"),
  quantity: qtyField.optional().or(z.literal("")).default("1"),
  isAvailable: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  providerId: optionalUuid,
  externalProductId: optionalText(120).nullable(),
  fallbackProviderId: optionalUuid,
  fallbackExternalProductId: optionalText(120).nullable(),
});

export const tierRowSchema = z.object({
  id: optionalUuid,
  minQty: qtyField,
  maxQty: qtyField.optional().or(z.literal("")),
  pricePerUnit: posAmountField,
});

export const qtyConfigSchema = z.object({
  unit: z.string().trim().min(1).max(30).default("وحدة"),
  minQty: qtyField,
  maxQty: qtyField.optional().or(z.literal("")),
  pricePerUnit: posAmountField.optional().or(z.literal("")),
  pricePer1000: posAmountField.optional().or(z.literal("")),
  // أسعار باقة التاجر (اختيارية) — أسعار مستقلة وليست خصمًا.
  traderPricePerUnit: posAmountField.optional().or(z.literal("")),
  traderPricePer1000: posAmountField.optional().or(z.literal("")),
  costPrice: nonNegAmountField.default("0"),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "الاسم قصير جدًا").max(120),
    slug: slugField,
    categoryId: z.string().uuid("اختر تصنيفًا"),
    type: z.enum(["package", "quantity"]),
    fulfillment: z.enum(["manual", "automatic", "stock"]),
    status: z.enum(["active", "hidden", "maintenance", "out_of_stock"]),
    imageId: optionalUuid,
    description: optionalText(2000),
    executionTime: optionalText(120),
    terms: optionalText(2000),
    warranty: optionalText(500),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    // حصري للتجار: يختفي عن بقية العملاء ولا يقبل طلباتهم.
    traderOnly: z.boolean().default(false),
    requiredFields: z.array(requiredFieldDefSchema).max(10).default([]),
    packages: z.array(packageRowSchema).max(50).default([]),
    qtyConfig: qtyConfigSchema.optional(),
    tiers: z.array(tierRowSchema).max(20).default([]),
  })
  .superRefine((p, ctx) => {
    if (p.type === "package" && p.packages.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["packages"],
        message: "أضف بكجًا واحدًا على الأقل",
      });
    }
    if (p.type === "quantity") {
      if (!p.qtyConfig) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["qtyConfig"],
          message: "أكمل إعدادات الكمية",
        });
      } else {
        const hasPrice =
          !!p.qtyConfig.pricePerUnit ||
          !!p.qtyConfig.pricePer1000 ||
          p.tiers.length > 0;
        if (!hasPrice) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["qtyConfig"],
            message: "حدد سعرًا: للوحدة، أو لكل 1000، أو شرائح أسعار",
          });
        }
        if (
          p.qtyConfig.maxQty &&
          Number(p.qtyConfig.maxQty) < Number(p.qtyConfig.minQty)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["qtyConfig"],
            message: "الحد الأقصى للكمية أقل من الحد الأدنى",
          });
        }
      }
    }
    const keys = new Set<string>();
    for (const f of p.requiredFields) {
      if (keys.has(f.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requiredFields"],
          message: `مفتاح الحقل مكرر: ${f.key}`,
        });
      }
      keys.add(f.key);
    }
  });

export type ProductInput = z.infer<typeof productSchema>;
