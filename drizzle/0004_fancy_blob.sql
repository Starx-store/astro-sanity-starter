ALTER TABLE "product_packages" ADD COLUMN "fallback_provider_id" uuid;--> statement-breakpoint
ALTER TABLE "product_packages" ADD COLUMN "fallback_external_product_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_packages" ADD CONSTRAINT "product_packages_fallback_provider_id_providers_id_fk" FOREIGN KEY ("fallback_provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
