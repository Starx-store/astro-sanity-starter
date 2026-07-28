import { z } from "zod";
import { AMOUNT_REGEX } from "@/lib/money";

/** حقل مبلغ: نص رقمي موجب حتى 8 كسور (الحساب الفعلي في money.ts بالخادم). */
export const amountFieldSchema = z
  .string()
  .trim()
  .regex(AMOUNT_REGEX, "صيغة المبلغ غير صالحة (مثال: 10 أو 10.50)")
  .refine((v) => Number(v) > 0, "يجب أن يكون المبلغ أكبر من صفر");

/** تعديل إداري للرصيد. */
export const walletAdjustSchema = z.object({
  direction: z.enum(["credit", "debit"], {
    errorMap: () => ({ message: "حدد نوع العملية (إضافة/خصم)" }),
  }),
  amount: amountFieldSchema,
  reason: z
    .string()
    .trim()
    .min(3, "السبب مطلوب (3 أحرف على الأقل)")
    .max(500, "السبب طويل جدًا"),
});

/** مراجعة طلب إيداع. */
export const depositReviewSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500, "السبب طويل جدًا").optional(),
  })
  .superRefine((d, ctx) => {
    if (d.action === "reject" && !d.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "سبب الرفض مطلوب",
      });
    }
  });

export type WalletAdjustInput = z.infer<typeof walletAdjustSchema>;
export type DepositReviewInput = z.infer<typeof depositReviewSchema>;
