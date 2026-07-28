import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * اتصال Drizzle بـ PostgreSQL عبر postgres.js.
 * نستخدم نمط Singleton لتفادي فتح اتصالات متعددة أثناء التطوير (HMR).
 */
const globalForDb = globalThis as unknown as {
  __evoSql?: ReturnType<typeof postgres>;
};

import { resolveDatabaseUrl, isSupabasePooler } from "./url";

const connectionString = resolveDatabaseUrl() || "postgresql://postgres:postgres@localhost:5432/evo_store";
if (
  connectionString.includes("[") ||
  connectionString.includes("]") ||
  connectionString.includes("YOUR-PASSWORD") ||
  connectionString.includes("REGION")
) {
  throw new Error(
    "DATABASE_URL ما زال يحتوي قيمًا قالبية لم تُستبدل ([YOUR-PASSWORD] أو REGION). " +
      "افتح .env وبدّلها بالقيم الحقيقية: من لوحة Supabase → زر Connect → Session pooler، " +
      "انسخ الرابط كاملًا وضع كلمة المرور بدون أقواس.",
  );
}
if (!/^postgres(ql)?:\/\//.test(connectionString)) {
  throw new Error(
    "DATABASE_URL غير صالح — يجب أن يبدأ بـ postgresql:// (انسخه من Supabase → Connect → Session pooler).",
  );
}

// مزوّدو السحابة (مثل Supabase) يفرضون SSL — نفعّله عند وجود sslmode=require.
const needsSsl = /sslmode=require/i.test(connectionString);
// عند استخدام Supabase Pooler (serverless/Vercel) نُعطّل الجمل المُحضّرة
// ونُقلّل عدد الاتصالات لكل دالة (lambda) لتفادي استنزاف المجمّع.
const isPooler = isSupabasePooler(connectionString);
const isProdRuntime = process.env.NODE_ENV === "production";

const client =
  globalForDb.__evoSql ??
  postgres(connectionString, {
    // ملاحظة إنتاج (Vercel Fluid): الطلبات المتزامنة تتشارك نفس العميل داخل
    // العملية الواحدة، واتصال وحيد (max: 1) يجمّد الاستعلامات المتزامنة عبر
    // الـ pooler (صفحة الأدمن مثلًا تطلق ~11 استعلامًا معًا). نسمح بعدة
    // اتصالات مع idle_timeout قصير كي لا نستنزف مجمّع Supabase.
    // في وضع التطوير نقلّل الاتصالات كي لا نستنزف مجمّع Session mode (حده 15).
    max: isProdRuntime ? 10 : 3,
    prepare: isPooler ? false : undefined,
    ssl: needsSsl ? "require" : undefined,
    // حاسم في serverless: أغلق الاتصال الخامل بسرعة ودوّره دوريًا،
    // وإلا احتفظت الـ lambda الدافئة بسوكيت ميت (يقطعه الـ pooler من طرفه
    // بعد الخمول) فتصطف الاستعلامات عليه للأبد وتعلق الصفحات بلا رد.
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    // شبكة أمان: أي استعلام يتجاوز 20 ثانية يفشل بدل أن تعلق الصفحة دقائق.
    connection: { statement_timeout: "20000" },
    // تحويل NUMERIC يبقى كسلسلة نصية افتراضيًا في postgres.js — نحافظ على ذلك للدقة المالية.
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__evoSql = client;
}

// ensure product_packages quantity & sub-package type columns exist
client`
  ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS quantity numeric(18,4) DEFAULT '1';
  ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'fixed';
  ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS price_per_1000 numeric(18,4);
  ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS trader_price_per_1000 numeric(18,4);
  ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS min_qty numeric(18,4) DEFAULT '1';
  ALTER TABLE product_packages ADD COLUMN IF NOT EXISTS max_qty numeric(18,4);
`.catch(() => {});

export const db = drizzle(client, { schema });
export { schema };
export type Database = typeof db;
