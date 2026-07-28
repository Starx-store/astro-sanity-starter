import { z } from "zod";

const password = z
  .string()
  .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
  .max(128, "كلمة المرور طويلة جدًا")
  .regex(/[A-Za-z]/, "يجب أن تحتوي على حرف واحد على الأقل")
  .regex(/[0-9]/, "يجب أن تحتوي على رقم واحد على الأقل");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("البريد الإلكتروني غير صالح");

// جوال دولي مبسّط: أرقام و+ فقط، أو فارغ إذا لم يكن إجبارياً.
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, "رقم الواتساب غير صالح")
  .optional()
  .or(z.literal(""));

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "الاسم قصير جدًا").max(80),
    email,
    phone,
    password,
    confirmPassword: z.string(),
    referralCode: z.string().trim().max(20).optional().or(z.literal("")),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "كلمتا المرور غير متطابقتين",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "أدخل كلمة المرور الحالية"),
    newPassword: password,
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "كلمتا المرور غير متطابقتين",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "أدخل كلمة المرور"),
  totp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "رمز مكوّن من 6 أرقام")
    .optional()
    .or(z.literal("")),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "رمز غير صالح"),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "كلمتا المرور غير متطابقتين",
  });

export const verifySchema = z.object({
  code: z.string().regex(/^[0-9]{6}$/, "رمز التحقق مكوّن من 6 أرقام"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

