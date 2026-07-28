/**
 * تطبيع رابط قاعدة البيانات — نقطة الحقيقة الوحيدة لكل من:
 * وقت التشغيل (index.ts)، والتهيئة (seed.ts)، والهجرات (drizzle.config.ts).
 *
 * - الأولوية للقاعدة الخارجية EXTERNAL_DATABASE_URL ثم قاعدة Replit المدمجة DATABASE_URL.
 * - Supabase Session pooler (منفذ 5432) محدود بـ 15 اتصالًا —
 *   نحوّل تلقائيًا إلى Transaction pooler (منفذ 6543).
 */
export function resolveDatabaseUrl(): string | undefined {
  let url = (process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL)?.trim();
  if (url && /pooler\.supabase\.com/i.test(url) && /:5432\//.test(url)) {
    url = url.replace(":5432/", ":6543/");
  }
  return url;
}

/** هل الرابط يمر عبر مجمّع Supabase (يتطلب prepare: false)? */
export function isSupabasePooler(url: string): boolean {
  return /pooler\.supabase\.com/i.test(url);
}
