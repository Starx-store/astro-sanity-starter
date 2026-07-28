ALTER TABLE "product_packages" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "product_packages" ADD COLUMN "external_product_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "api_key" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_packages" ADD CONSTRAINT "product_packages_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_api_key_uq" ON "users" USING btree ("api_key");