/**
 * مخطط قاعدة بيانات Evo Store (Drizzle ORM / PostgreSQL).
 *
 * مبادئ حاكمة:
 * - كل المبالغ NUMERIC(18,8) — لا FLOAT إطلاقًا. Drizzle يعيدها كسلسلة نصية للحفاظ على الدقة.
 * - wallet_transactions سجل إلحاقي (Append-only) لا يُعدّل ولا يُحذف — يُفرض بـ Trigger في الهجرة.
 * - الخادم مصدر الحقيقة للسعر والرصيد.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*  مساعدات                                                            */
/* ------------------------------------------------------------------ */

const money = (name: string) => numeric(name, { precision: 18, scale: 8 });

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/*  التعدادات (Enums)                                                  */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", ["customer", "staff", "admin"]);
export const userStatus = pgEnum("user_status", [
  "active",
  "suspended",
  "banned",
]);
export const verificationChannel = pgEnum("verification_channel", [
  "email",
  "phone",
]);

export const txType = pgEnum("wallet_tx_type", [
  "deposit",
  "purchase",
  "refund",
  "hold",
  "release",
  "admin_credit",
  "admin_debit",
  "correction",
]);
export const txDirection = pgEnum("tx_direction", ["credit", "debit"]);
export const txStatus = pgEnum("tx_status", [
  "pending",
  "completed",
  "reversed",
]);
export const txSource = pgEnum("tx_source", [
  "admin",
  "deposit_request",
  "binance",
  "order",
  "system",
]);

export const depositMethod = pgEnum("deposit_method", [
  "manual_admin",
  "manual_customer",
  "binance",
  // شحن بعملة رقمية على شبكة BEP20 — يُتحقق منه من البلوكتشين مباشرة.
  "crypto",
]);
export const depositStatus = pgEnum("deposit_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
  "completed",
]);

export const productType = pgEnum("product_type", ["package", "quantity"]);
export const fulfillmentType = pgEnum("fulfillment_type", [
  "manual",
  "automatic",
  // تسليم فوري من مخزون أكواد/حسابات مخزّنة في الموقع
  "stock",
]);

export const stockItemStatus = pgEnum("stock_item_status", [
  "available",
  "sold",
]);
export const productStatus = pgEnum("product_status", [
  "active",
  "hidden",
  "maintenance",
  "out_of_stock",
]);

export const providerMarkupType = pgEnum("provider_markup_type", [
  "fixed",
  "percent",
]);
export const providerStatus = pgEnum("provider_status", ["active", "paused"]);

export const orderStatus = pgEnum("order_status", [
  "awaiting_payment",
  "under_review",
  "sent_to_provider",
  "in_progress",
  "completed",
  "partially_completed",
  "cancelled",
  "failed",
  "refunded",
  "needs_manual",
  "needs_info",
]);
export const messageSender = pgEnum("message_sender", ["customer", "staff"]);

export const ticketPriority = pgEnum("ticket_priority", [
  "low",
  "normal",
  "high",
]);
export const ticketStatus = pgEnum("ticket_status", [
  "new",
  "in_progress",
  "awaiting_customer",
  "closed",
]);

export const notificationChannel = pgEnum("notification_channel", [
  "in_app",
  "email",
]);
export const discountType = pgEnum("discount_type", ["fixed", "percent"]);

/* ------------------------------------------------------------------ */
/*  المستخدمون والمصادقة                                               */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // البريد يُخزّن دائمًا بحروف صغيرة (تطبيق دور CITEXT على مستوى التطبيق).
    email: text("email").notNull(),
    phone: text("phone"),
    // اختياري: حسابات جوجل قد لا تملك كلمة مرور.
    passwordHash: text("password_hash"),
    // معرّف حساب جوجل (sub) لمن سجّل بجوجل.
    googleId: text("google_id"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    role: userRole("role").notNull().default("customer"),
    status: userStatus("status").notNull().default("active"),
    twoFactorSecret: text("two_factor_secret"), // مشفّر at-rest، للأدمن/الموظفين
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    // باقة التاجر — يعيّنها الأدمن يدويًا؛ تمنح السعر الخاص بالتجار حيث حُدّد.
    isTrader: boolean("is_trader").notNull().default(false),
    membershipTier: text("membership_tier").notNull().default("standard"), // standard | silver | gold | platinum
    referralCode: text("referral_code"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    apiKey: text("api_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    emailUq: uniqueIndex("users_email_uq").on(t.email),
    phoneUq: uniqueIndex("users_phone_uq").on(t.phone),
    googleIdx: index("users_google_idx").on(t.googleId),
    roleIdx: index("users_role_idx").on(t.role),
    referralCodeUq: uniqueIndex("users_referral_code_uq").on(t.referralCode),
    apiKeyUq: uniqueIndex("users_api_key_uq").on(t.apiKey),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // نخزّن تجزئة الرمز فقط، لا الرمز نفسه.
    tokenHash: text("token_hash").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    tokenUq: uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

export const staffPermissions = pgTable(
  "staff_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(), // مثل orders.manage, wallet.adjust
    createdAt: createdAt(),
  },
  (t) => ({
    uq: uniqueIndex("staff_perm_uq").on(t.userId, t.permission),
  }),
);

export const verifications = pgTable(
  "email_phone_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: verificationChannel("channel").notNull(),
    // تجزئة الرمز (OTP) لا الرمز نفسه.
    codeHash: text("code_hash").notNull(),
    target: text("target").notNull(), // البريد أو رقم الجوال المستهدف
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index("verif_user_idx").on(t.userId),
  }),
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    tokenUq: uniqueIndex("pw_reset_token_uq").on(t.tokenHash),
    userIdx: index("pw_reset_user_idx").on(t.userId),
  }),
);

/* ------------------------------------------------------------------ */
/*  المرفقات                                                           */
/* ------------------------------------------------------------------ */

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  storageKey: text("storage_key").notNull(),
  // محتوى الملف بترميز base64 — يجعل التخزين متوافقًا مع بيئات serverless (Vercel)
  // بلا نظام ملفات قابل للكتابة. للملفات الصغيرة (إثباتات التحويل).
  data: text("data"),
  fileName: text("file_name"),
  mime: text("mime"),
  size: bigint("size", { mode: "number" }),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/*  المحفظة والسجل المالي                                              */
/* ------------------------------------------------------------------ */

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("USD"),
    balance: money("balance").notNull().default("0"),
    heldBalance: money("held_balance").notNull().default("0"),
    version: bigint("version", { mode: "number" }).notNull().default(0),
    updatedAt: updatedAt(),
    createdAt: createdAt(),
  },
  (t) => ({
    userUq: uniqueIndex("wallets_user_uq").on(t.userId),
  }),
);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceNo: text("reference_no").notNull(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "restrict" }),
    type: txType("type").notNull(),
    direction: txDirection("direction").notNull(),
    amount: money("amount").notNull(), // موجب دائمًا
    balanceBefore: money("balance_before").notNull(),
    balanceAfter: money("balance_after").notNull(),
    status: txStatus("status").notNull().default("completed"),
    source: txSource("source").notNull(),
    // مراجع دائرية — تُحل بـ AnyPgColumn (الجداول مُعرّفة لاحقًا).
    relatedOrderId: uuid("related_order_id").references(
      (): AnyPgColumn => orders.id,
      { onDelete: "set null" },
    ),
    relatedDepositId: uuid("related_deposit_id").references(
      (): AnyPgColumn => depositRequests.id,
      { onDelete: "set null" },
    ),
    idempotencyKey: text("idempotency_key"),
    performedBy: uuid("performed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => ({
    refUq: uniqueIndex("wtx_reference_uq").on(t.referenceNo),
    idemUq: uniqueIndex("wtx_idempotency_uq").on(t.idempotencyKey),
    walletIdx: index("wtx_wallet_idx").on(t.walletId),
    createdIdx: index("wtx_created_idx").on(t.createdAt),
  }),
);

export const depositRequests = pgTable(
  "deposit_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    method: depositMethod("method").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: depositStatus("status").notNull().default("pending"),
    proofFileId: uuid("proof_file_id").references(() => attachments.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id"), // prepayId / merchantTradeNo
    externalStatus: text("external_status"),
    confirmations: integer("confirmations"),
    // شحن الكريبتو: رقم المعاملة على السلسلة (فريد ⇒ يستحيل استخدامه مرتين).
    txHash: text("tx_hash"),
    network: text("network"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    rejectReason: text("reject_reason"),
    walletTransactionId: uuid("wallet_transaction_id").references(
      () => walletTransactions.id,
      { onDelete: "set null" },
    ),
    idempotencyKey: text("idempotency_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    idemUq: uniqueIndex("deposit_idempotency_uq").on(t.idempotencyKey),
    userIdx: index("deposit_user_idx").on(t.userId),
    statusIdx: index("deposit_status_idx").on(t.status),
    // رقم معاملة السلسلة يُستخدم مرة واحدة فقط في المتجر كله.
    txUq: uniqueIndex("deposit_tx_hash_uq").on(t.txHash),
  }),
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(), // binance ...
    eventType: text("event_type").notNull(),
    externalId: text("external_id").notNull(),
    signatureValid: boolean("signature_valid").notNull().default(false),
    rawPayload: jsonb("raw_payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    // منع المعالجة المكررة لنفس الحدث.
    uq: uniqueIndex("payment_event_uq").on(
      t.provider,
      t.externalId,
      t.eventType,
    ),
  }),
);

/* ------------------------------------------------------------------ */
/*  التصنيفات والمنتجات                                                */
/* ------------------------------------------------------------------ */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    slugUq: uniqueIndex("categories_slug_uq").on(t.slug),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    type: productType("type").notNull(),
    fulfillment: fulfillmentType("fulfillment").notNull().default("manual"),
    imageId: uuid("image_id").references(() => attachments.id, {
      onDelete: "set null",
    }),
    status: productStatus("status").notNull().default("hidden"),
    executionTime: text("execution_time"),
    terms: text("terms"),
    warranty: text("warranty"),
    requiredFields: jsonb("required_fields")
      .notNull()
      .default(sql`'[]'::jsonb`),
    reviewsEnabled: boolean("reviews_enabled").notNull().default(false),
    // منتج حصري لباقة التاجر — لا يظهر ولا يُطلب إلا من حسابات التجار.
    traderOnly: boolean("trader_only").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    slugUq: uniqueIndex("products_slug_uq").on(t.slug),
    categoryIdx: index("products_category_idx").on(t.categoryId),
    statusIdx: index("products_status_idx").on(t.status),
  }),
);

export const productPackages = pgTable(
  "product_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id").references((): AnyPgColumn => providers.id, { onDelete: "set null" }),
    externalProductId: text("external_product_id"),
    fallbackProviderId: uuid("fallback_provider_id").references((): AnyPgColumn => providers.id, { onDelete: "set null" }),
    fallbackExternalProductId: text("fallback_external_product_id"),
    name: text("name").notNull(),
    description: text("description"),
    salePrice: money("sale_price").notNull(),
    // السعر الخاص بباقة التاجر (اختياري) — سعر مستقل، ليس نسبة خصم.
    traderPrice: money("trader_price"),
    packageType: text("package_type").notNull().default("fixed"), // fixed | quantity
    pricePer1000: money("price_per_1000"),
    traderPricePer1000: money("trader_price_per_1000"),
    costPrice: money("cost_price").notNull().default("0"),
    costPricePer1000: money("cost_price_per_1000"),
    minQty: numeric("min_qty", { precision: 18, scale: 4 }).default("1"),
    maxQty: numeric("max_qty", { precision: 18, scale: 4 }),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).default("1"),
    options: jsonb("options"), // مدة/منطقة/نوع حساب
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    productIdx: index("packages_product_idx").on(t.productId),
  }),
);

export const productQuantityConfig = pgTable("product_quantity_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  unit: text("unit").notNull().default("unit"),
  minQty: numeric("min_qty", { precision: 18, scale: 4 }).notNull().default("1"),
  maxQty: numeric("max_qty", { precision: 18, scale: 4 }),
  pricePerUnit: money("price_per_unit"),
  pricePer1000: money("price_per_1000"),
  // أسعار باقة التاجر (اختيارية) — أسعار مستقلة للتجار، ليست خصمًا.
  traderPricePerUnit: money("trader_price_per_unit"),
  traderPricePer1000: money("trader_price_per_1000"),
  costPrice: money("cost_price").notNull().default("0"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * مخزون التسليم الفوري — أكواد/حسابات مخزّنة تُسلَّم تلقائيًا عند الشراء.
 * كل صف عنصر واحد (كود، حساب...) يُقفل بـ SKIP LOCKED عند البيع فلا يُباع مرتين.
 */
export const productStockItems = pgTable(
  "product_stock_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    packageId: uuid("package_id").references(() => productPackages.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    status: stockItemStatus("status").notNull().default("available"),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    productStatusIdx: index("stock_product_status_idx").on(
      t.productId,
      t.status,
    ),
    packageIdx: index("stock_package_idx").on(t.packageId),
  }),
);

/**
 * سعر خاص لعميل بعينه على منتج بعينه — يحدده الأدمن يدويًا ويتقدّم على
 * سعر التاجر وخصومات الباقات معًا (أعلى أولوية في التسعير).
 */
export const customerPrices = pgTable(
  "customer_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // لمنتجات البكجات: السعر خاص ببكج محدد.
    packageId: uuid("package_id").references(() => productPackages.id, {
      onDelete: "cascade",
    }),
    // منتج بكجات: سعر البكج. منتج كمية: السعر لكل 1000.
    price: money("price").notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    userProductIdx: index("customer_price_user_product_idx").on(
      t.userId,
      t.productId,
    ),
  }),
);

export const priceTiers = pgTable(
  "price_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    minQty: numeric("min_qty", { precision: 18, scale: 4 }).notNull(),
    maxQty: numeric("max_qty", { precision: 18, scale: 4 }),
    pricePerUnit: money("price_per_unit").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    productIdx: index("tiers_product_idx").on(t.productId),
  }),
);

/* ------------------------------------------------------------------ */
/*  المزوّدون                                                          */
/* ------------------------------------------------------------------ */

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  credentials: text("credentials"), // مشفّرة at-rest — لا تخرج للواجهة أبدًا
  adapter: text("adapter").notNull().default("generic"),
  markupType: providerMarkupType("markup_type").notNull().default("percent"),
  markupValue: numeric("markup_value", { precision: 10, scale: 4 })
    .notNull()
    .default("0"),
  balance: money("balance"),
  status: providerStatus("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const providerProducts = pgTable(
  "provider_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    externalProductId: text("external_product_id").notNull(),
    // آخر سعر معروف لدى المزوّد لكل 1000 — أساس حساب سعر البيع.
    externalPrice: money("external_price"),
    // هامش الربح على سعر المزوّد: مبلغ ثابت لكل 1000 أو نسبة مئوية.
    markupType: providerMarkupType("markup_type").notNull().default("percent"),
    markupValue: numeric("markup_value", { precision: 10, scale: 4 })
      .notNull()
      .default("0"),
    // مزامنة تلقائية: يرتفع سعرنا مع ارتفاع سعر المزوّد.
    autoSyncPrice: boolean("auto_sync_price").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => ({
    uq: uniqueIndex("provider_product_uq").on(t.providerId, t.productId),
    // منع استيراد نفس خدمة المزوّد مرتين (حماية على مستوى القاعدة).
    extUq: uniqueIndex("provider_external_uq").on(
      t.providerId,
      t.externalProductId,
    ),
  }),
);

/* ------------------------------------------------------------------ */
/*  الطلبات                                                            */
/* ------------------------------------------------------------------ */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNo: text("order_no").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    packageId: uuid("package_id").references(() => productPackages.id, {
      onDelete: "set null",
    }),
    quantity: numeric("quantity", { precision: 18, scale: 4 }),
    unitPrice: money("unit_price").notNull(),
    totalPrice: money("total_price").notNull(),
    costPrice: money("cost_price").notNull().default("0"),
    fulfillment: fulfillmentType("fulfillment").notNull(),
    providerId: uuid("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),
    externalOrderId: text("external_order_id"),
    status: orderStatus("status").notNull().default("awaiting_payment"),
    inputData: jsonb("input_data"),
    deliveryData: jsonb("delivery_data"),
    holdTransactionId: uuid("hold_transaction_id").references(
      () => walletTransactions.id,
      { onDelete: "set null" },
    ),
    settleTransactionId: uuid("settle_transaction_id").references(
      () => walletTransactions.id,
      { onDelete: "set null" },
    ),
    refundTransactionId: uuid("refund_transaction_id").references(
      () => walletTransactions.id,
      { onDelete: "set null" },
    ),
    idempotencyKey: text("idempotency_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orderNoUq: uniqueIndex("orders_no_uq").on(t.orderNo),
    idemUq: uniqueIndex("orders_idempotency_uq").on(t.idempotencyKey),
    userIdx: index("orders_user_idx").on(t.userId),
    statusIdx: index("orders_status_idx").on(t.status),
    createdIdx: index("orders_created_idx").on(t.createdAt),
  }),
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => ({
    orderIdx: index("order_history_order_idx").on(t.orderId),
  }),
);

export const orderMessages = pgTable(
  "order_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    sender: messageSender("sender").notNull(),
    senderId: uuid("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    attachmentId: uuid("attachment_id").references(() => attachments.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => ({
    orderIdx: index("order_messages_order_idx").on(t.orderId),
  }),
);

export const providerApiLogs = pgTable(
  "provider_api_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    requestEndpoint: text("request_endpoint").notNull(),
    requestPayload: jsonb("request_payload"), // منقّى من الأسرار
    responsePayload: jsonb("response_payload"),
    httpStatus: integer("http_status"),
    latencyMs: integer("latency_ms"),
    success: boolean("success").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => ({
    providerIdx: index("api_logs_provider_idx").on(t.providerId),
    orderIdx: index("api_logs_order_idx").on(t.orderId),
  }),
);

/* ------------------------------------------------------------------ */
/*  الدعم والإشعارات والتدقيق                                          */
/* ------------------------------------------------------------------ */

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNo: text("ticket_no").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    department: text("department"),
    priority: ticketPriority("priority").notNull().default("normal"),
    relatedOrderId: uuid("related_order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    status: ticketStatus("status").notNull().default("new"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ticketNoUq: uniqueIndex("tickets_no_uq").on(t.ticketNo),
    userIdx: index("tickets_user_idx").on(t.userId),
  }),
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    sender: messageSender("sender").notNull(),
    senderId: uuid("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    attachmentId: uuid("attachment_id").references(() => attachments.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => ({
    ticketIdx: index("support_messages_ticket_idx").on(t.ticketId),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    channel: notificationChannel("channel").notNull().default("in_app"),
    readAt: timestamp("read_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => ({
    actorIdx: index("audit_actor_idx").on(t.actorId),
    entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
  }),
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    type: discountType("type").notNull(),
    value: numeric("value", { precision: 18, scale: 4 }).notNull(),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    minAmount: money("min_amount"),
    // تخصيص لمنتج معين (null = شامل لجميع المنتجات)
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    // حد الاستخدام لكل عميل (null = بلا حد).
    perUserLimit: integer("per_user_limit"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    codeUq: uniqueIndex("discount_code_uq").on(t.code),
  }),
);

/**
 * استخدامات الكوبونات — صف لكل (كوبون، طلب). الفهرس الفريد على الطلب
 * يمنع احتساب الكوبون مرتين لنفس الطلب، وفهرس (كوبون، مستخدم) يُستخدم
 * لتطبيق حد "مرة واحدة لكل عميل".
 */
export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => discountCodes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    amountOff: money("amount_off").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    orderUq: uniqueIndex("redemption_order_uq").on(t.orderId),
    codeUserIdx: index("redemption_code_user_idx").on(t.codeId, t.userId),
  }),
);

export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankName: text("bank_name").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  iban: text("iban"),
  currency: text("currency").notNull().default("SAR"),
  notes: text("notes"),
  logo: text("logo"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  referredId: uuid("referred_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => ({
  referredUq: uniqueIndex("referrals_referred_uq").on(t.referredId),
  referrerIdx: index("referrals_referrer_idx").on(t.referrerId),
}));

export const referralEarnings = pgTable("referral_earnings", {
  id: uuid("id").primaryKey().defaultRandom(),
  referralId: uuid("referral_id")
    .notNull()
    .references(() => referrals.id, { onDelete: "cascade" }),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "restrict" }),
  orderAmount: money("order_amount").notNull(),
  costAmount: money("cost_amount").notNull(),
  profitAmount: money("profit_amount").notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull(),
  commissionAmount: money("commission_amount").notNull(),
  walletTransactionId: uuid("wallet_transaction_id")
    .references(() => walletTransactions.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => ({
  orderUq: uniqueIndex("referral_earnings_order_uq").on(t.orderId),
  referralIdx: index("referral_earnings_referral_idx").on(t.referralId),
}));

/* ------------------------------------------------------------------ */
/*  أنواع مشتقّة للاستخدام في التطبيق                                  */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type DepositRequest = typeof depositRequests.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Product = typeof products.$inferSelect;

export type BankAccount = typeof bankAccounts.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type ReferralEarning = typeof referralEarnings.$inferSelect;
