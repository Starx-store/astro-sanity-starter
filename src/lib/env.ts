import { z } from "zod";

/**
 * التحقق من متغيرات البيئة الخادمية عند الإقلاع.
 * هذه القيم لا تصل الواجهة الأمامية أبدًا (لا تبدأ بـ NEXT_PUBLIC_).
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres")),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET يجب أن يكون 32 حرفًا على الأقل"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  // تسجيل الدخول بجوجل (اختياري). معرّف العميل عام بطبيعته في OAuth
  // فنستخدمه كمتغير NEXT_PUBLIC ليعرف الواجهة عرض الزر؛ والسر خادمي فقط.
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`متغيرات البيئة غير صالحة:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => process.env.NODE_ENV === "production";
