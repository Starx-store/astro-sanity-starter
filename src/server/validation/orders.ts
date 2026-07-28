import { z } from "zod";
import { QTY_REGEX } from "@/lib/money";

export const createOrderSchema = z.object({
  productId: z.string().uuid("منتج غير صالح"),
  packageId: z.string().uuid("بكج غير صالح").optional(),
  quantity: z
    .string()
    .trim()
    .regex(QTY_REGEX, "كمية غير صالحة")
    .optional(),
  inputs: z.record(z.string(), z.unknown()).default({}),
  /** يولّده العميل لكل محاولة شراء — يمنع الطلب المكرر عند الضغط المزدوج. */
  idempotencyKey: z.string().uuid("مفتاح الطلب غير صالح"),
  /** رمز كوبون اختياري. */
  couponCode: z.string().trim().max(40).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderMessageSchema = z.object({
  body: z.string().trim().min(1, "اكتب رسالة").max(2000, "الرسالة طويلة جدًا"),
});

export const adminOrderStatusSchema = z
  .object({
    to: z.enum(["in_progress", "needs_info", "completed", "refunded"]),
    note: z.string().trim().max(500, "الملاحظة طويلة جدًا").optional().or(z.literal("")),
    deliveryText: z
      .string()
      .trim()
      .max(5000, "بيانات التسليم طويلة جدًا")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    if (d.to === "refunded" && !d.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "سبب الاسترجاع مطلوب",
      });
    }
    if (d.to === "needs_info" && !d.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "وضّح المعلومات المطلوبة من العميل",
      });
    }
  });

export type AdminOrderStatusInput = z.infer<typeof adminOrderStatusSchema>;
