/**
 * سكربت التهيئة (Seed):
 * - يطبّق تصليب قاعدة البيانات (append-only trigger + قيود).
 * - ينشئ إعدادات المتجر الأساسية.
 * - ينشئ حساب أدمن ومحفظته.
 * - ينشئ تصنيفات ابتدائية.
 *
 * التشغيل: npm run db:seed
 * متغيرات اختيارية: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { resolveDatabaseUrl, isSupabasePooler } from "./url";

const { users, wallets, categories, settings } = schema;

async function main() {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL غير معرّف.");

  const client = postgres(url, {
    max: 1,
    prepare: isSupabasePooler(url) ? false : undefined,
    ssl: /sslmode=require/i.test(url) ? "require" : undefined,
  });
  const db = drizzle(client, { schema });

  console.log("→ تطبيق تصليب قاعدة البيانات (append-only)...");
  const hardeningSql = readFileSync(
    join(process.cwd(), "src/server/db/sql/00_hardening.sql"),
    "utf8",
  );
  await client.unsafe(hardeningSql);

  console.log("→ إعدادات المتجر الأساسية...");
  const defaultSettings: Array<{ key: string; value: unknown }> = [
    { key: "store.name", value: "Evo Store" },
    { key: "store.currency", value: "USD" },
    { key: "store.min_deposit", value: 1 },
    { key: "store.maintenance", value: false },
    { key: "brand.colors", value: { black: "#0a0a0c", gold: "#d4af37" } },
  ];
  for (const s of defaultSettings) {
    await db
      .insert(settings)
      .values({ key: s.key, value: s.value as object })
      .onConflictDoNothing();
  }

  console.log("→ حساب الأدمن...");
  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ?? "admin@evo.store"
  ).toLowerCase();
  const adminName = process.env.SEED_ADMIN_NAME ?? "مدير Evo";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345";

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const [admin] = await db
      .insert(users)
      .values({
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: "admin",
        status: "active",
        emailVerifiedAt: new Date(),
      })
      .returning();
    await db.insert(wallets).values({ userId: admin.id, currency: "USD" });
    console.log(`  ✓ تم إنشاء حساب الأدمن: ${adminEmail} (كلمة المرور من SEED_ADMIN_PASSWORD)`);
  } else {
    console.log(`  • الأدمن موجود مسبقًا: ${adminEmail}`);
  }

  console.log("→ تصنيفات ابتدائية...");
  const cats = [
    { name: "شحن الألعاب", slug: "games", icon: "gamepad-2", sortOrder: 1 },
    { name: "خدمات التواصل", slug: "social", icon: "share-2", sortOrder: 2 },
    { name: "بطاقات وأرصدة", slug: "cards", icon: "credit-card", sortOrder: 3 },
    { name: "اشتراكات رقمية", slug: "subscriptions", icon: "package", sortOrder: 4 },
  ];
  for (const c of cats) {
    await db.insert(categories).values(c).onConflictDoNothing();
  }

  // فحص سريع: تأكد أن عدّاد المستخدمين منطقي.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  console.log(`✓ اكتمل التهيئة. إجمالي المستخدمين: ${count}`);

  await client.end();
}

main().catch((err) => {
  console.error("✗ فشل التهيئة:", err);
  process.exit(1);
});
