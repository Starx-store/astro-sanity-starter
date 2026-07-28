import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("-> إضافة بيانات تجريبية شاملة للمتجر...");
  
  const url = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/evo_store";
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  const { bankAccounts, products, productPackages, categories, settings } = schema;

  // 1. حسابات بنكية تجريبية
  const existingBanks = await db.select().from(bankAccounts);
  if (existingBanks.length === 0) {
    await db.insert(bankAccounts).values([
      {
        bankName: "مصرف الراجحي",
        accountName: "مؤسسة متجر إيفو الرقمي",
        accountNumber: "123456789012345",
        iban: "SA0380000123456789012345",
        currency: "SAR",
        notes: "يرجى كتابة رقم الجوال في ملاحظة التحويل",
        isActive: true,
        sortOrder: 1,
      },
      {
        bankName: "البنك الأهلي السعودي (SNB)",
        accountName: "مؤسسة متجر إيفو الرقمي",
        accountNumber: "987654321098765",
        iban: "SA4410000987654321098765",
        currency: "SAR",
        notes: "تحويل فوري متاح 24/7",
        isActive: true,
        sortOrder: 2,
      },
    ]);
    console.log("✓ تم إضافة حسابات بنكية تجريبية.");
  }

  // 2. إعدادات الإعلانات وكود التاجر
  await db.insert(settings).values({
    key: "announcement.enabled",
    value: true,
  }).onConflictDoUpdate({ target: settings.key, set: { value: true } });

  await db.insert(settings).values({
    key: "announcement.text_ar",
    value: "مرحباً بك في Evo Store! انضم لنظام الإحالة واربح 2.5% عمولة على المبيعات!",
  }).onConflictDoUpdate({ target: settings.key, set: { value: "مرحباً بك في Evo Store! انضم لنظام الإحالة واربح 2.5% عمولة على المبيعات!" } });

  await db.insert(settings).values({
    key: "announcement.text_en",
    value: "Welcome to Evo Store! Join our Referral Program & earn 2.5% commission!",
  }).onConflictDoUpdate({ target: settings.key, set: { value: "Welcome to Evo Store! Join our Referral Program & earn 2.5% commission!" } });

  await db.insert(settings).values({
    key: "announcement.badge",
    value: "عرض خاص",
  }).onConflictDoUpdate({ target: settings.key, set: { value: "عرض خاص" } });

  await db.insert(settings).values({
    key: "referral.trader_code",
    value: "TRADER",
  }).onConflictDoUpdate({ target: settings.key, set: { value: "TRADER" } });

  // 3. منتجات وبكجات تجريبية
  const cats = await db.select().from(categories);
  const gamesCat = cats.find((c) => c.slug === "games") || cats[0];
  const socialCat = cats.find((c) => c.slug === "social") || cats[1];

  if (gamesCat) {
    const existingProducts = await db.select().from(products).where(eq(products.categoryId, gamesCat.id));
    if (existingProducts.length === 0) {
      const [pubg] = await db.insert(products).values({
        categoryId: gamesCat.id,
        name: "شحن شدات ببجي (PUBG UC)",
        slug: "pubg-mobile-uc",
        description: "شحن فوري ومباشر لشدات ببجي موبايل عن طريق الايدي (ID)",
        type: "package",
        status: "active",
        executionTime: "فوري (1 - 5 دقائق)",
        requiredFields: [{ key: "player_id", label: "معرّف اللاعب (Player ID)", type: "text", required: true }],
      }).returning();

      await db.insert(productPackages).values([
        {
          productId: pubg.id,
          name: "60 شدة UC",
          salePrice: "1.25",
          traderPrice: "1.00",
          costPrice: "0.80",
          isAvailable: true,
          sortOrder: 1,
        },
        {
          productId: pubg.id,
          name: "325 شدة UC",
          salePrice: "5.50",
          traderPrice: "4.80",
          costPrice: "4.00",
          isAvailable: true,
          sortOrder: 2,
        },
        {
          productId: pubg.id,
          name: "660 شدة UC",
          salePrice: "10.99",
          traderPrice: "9.50",
          costPrice: "8.20",
          isAvailable: true,
          sortOrder: 3,
        },
      ]);
      console.log("✓ تم إضافة منتجات شحن الألعاب.");
    }
  }

  if (socialCat) {
    const existingSocial = await db.select().from(products).where(eq(products.categoryId, socialCat.id));
    if (existingSocial.length === 0) {
      const [insta] = await db.insert(products).values({
        categoryId: socialCat.id,
        name: "متابعين انستقرام حقيقيين",
        slug: "instagram-followers",
        description: "زيادة متابعين انستقرام مع ضمان تعويض 30 يوم",
        type: "package",
        status: "active",
        executionTime: "10 دقائق - 24 ساعة",
        requiredFields: [{ key: "profile_link", label: "رابط الحساب (Link)", type: "url", required: true }],
      }).returning();

      await db.insert(productPackages).values([
        {
          productId: insta.id,
          name: "1,000 متابع انستقرام",
          salePrice: "2.00",
          traderPrice: "1.50",
          costPrice: "0.90",
          isAvailable: true,
          sortOrder: 1,
        },
        {
          productId: insta.id,
          name: "5,000 متابع انستقرام",
          salePrice: "8.50",
          traderPrice: "7.00",
          costPrice: "4.20",
          isAvailable: true,
          sortOrder: 2,
        },
      ]);
      console.log("✓ تم إضافة خدمات التواصل الاجتماعي.");
    }
  }

  console.log("اكتمل إضافة كل البيانات التجريبية والموقع جاهز بالكامل!");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
