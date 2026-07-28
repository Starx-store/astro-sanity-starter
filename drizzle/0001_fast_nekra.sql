CREATE TYPE "public"."stock_item_status" AS ENUM('available', 'sold');--> statement-breakpoint
ALTER TYPE "public"."deposit_method" ADD VALUE 'crypto';--> statement-breakpoint
ALTER TYPE "public"."fulfillment_type" ADD VALUE 'stock';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"package_id" uuid,
	"price" numeric(18, 8) NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discount_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"amount_off" numeric(18, 8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_stock_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"package_id" uuid,
	"content" text NOT NULL,
	"status" "stock_item_status" DEFAULT 'available' NOT NULL,
	"order_id" uuid,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "data" text;--> statement-breakpoint
ALTER TABLE "deposit_requests" ADD COLUMN "tx_hash" text;--> statement-breakpoint
ALTER TABLE "deposit_requests" ADD COLUMN "network" text;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "per_user_limit" integer;--> statement-breakpoint
ALTER TABLE "product_packages" ADD COLUMN "trader_price" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "product_quantity_config" ADD COLUMN "trader_price_per_unit" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "product_quantity_config" ADD COLUMN "trader_price_per_1000" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "provider_products" ADD COLUMN "markup_type" "provider_markup_type" DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_products" ADD COLUMN "markup_value" numeric(10, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_products" ADD COLUMN "auto_sync_price" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_trader" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_package_id_product_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."product_packages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_code_id_discount_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."discount_codes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_stock_items" ADD CONSTRAINT "product_stock_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_stock_items" ADD CONSTRAINT "product_stock_items_package_id_product_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."product_packages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_stock_items" ADD CONSTRAINT "product_stock_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_price_user_product_idx" ON "customer_prices" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "redemption_order_uq" ON "discount_redemptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "redemption_code_user_idx" ON "discount_redemptions" USING btree ("code_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_product_status_idx" ON "product_stock_items" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_package_idx" ON "product_stock_items" USING btree ("package_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deposit_tx_hash_uq" ON "deposit_requests" USING btree ("tx_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_external_uq" ON "provider_products" USING btree ("provider_id","external_product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_google_idx" ON "users" USING btree ("google_id");