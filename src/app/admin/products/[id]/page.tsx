import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { z } from "zod";
import { db } from "@/server/db";
import {
  categories,
  products,
  productPackages,
  productQuantityConfig,
  priceTiers,
  providers,
} from "@/server/db/schema";
import { requiredFieldDefSchema } from "@/server/validation/catalog";
import { displayAmount } from "@/lib/money";
import { isUuid } from "@/lib/utils";
import { ProductForm } from "@/components/admin/product-form";
import { ProductDeleteButton } from "@/components/admin/product-delete-button";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function EditProductPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  await requirePagePermission(PERMISSIONS.productsEdit);

  if (!isUuid(params.id)) notFound();

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, params.id))
    .limit(1);
  if (!product) notFound();

  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const provs = await db
    .select({ id: providers.id, name: providers.name })
    .from(providers)
    .where(eq(providers.status, "active"))
    .orderBy(asc(providers.name));

  const pkgs = await db
    .select()
    .from(productPackages)
    .where(eq(productPackages.productId, product.id))
    .orderBy(asc(productPackages.sortOrder), asc(productPackages.name));

  const [cfg] = await db
    .select()
    .from(productQuantityConfig)
    .where(eq(productQuantityConfig.productId, product.id))
    .limit(1);

  const tiers = await db
    .select()
    .from(priceTiers)
    .where(eq(priceTiers.productId, product.id))
    .orderBy(asc(priceTiers.minQty));

  const defs = z.array(requiredFieldDefSchema).safeParse(product.requiredFields);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        كل المنتجات
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">تعديل: {product.name}</h1>
        <div className="flex items-center gap-4">
          <Link
            href={`/products/${encodeURIComponent(product.slug)}`}
            target="_blank"
            className="text-sm font-medium text-gold hover:underline"
          >
            معاينة في المتجر ↗
          </Link>
          <ProductDeleteButton
            productId={product.id}
            productName={product.name}
          />
        </div>
      </div>

      <ProductForm
        isNew={false}
        categories={cats}
        providers={provs}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          categoryId: product.categoryId,
          type: product.type,
          fulfillment: product.fulfillment,
          status: product.status,
          traderOnly: product.traderOnly,
          imageId: product.imageId,
          description: product.description ?? "",
          executionTime: product.executionTime ?? "",
          terms: product.terms ?? "",
          warranty: product.warranty ?? "",
          sortOrder: product.sortOrder,
          requiredFields: defs.success ? defs.data : [],
          packages: pkgs.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description ?? "",
            salePrice: displayAmount(p.salePrice),
            traderPrice: p.traderPrice ? displayAmount(p.traderPrice) : "",
            costPrice: displayAmount(p.costPrice),
            isAvailable: p.isAvailable,
            sortOrder: p.sortOrder,
            providerId: p.providerId,
            externalProductId: p.externalProductId,
            fallbackProviderId: p.fallbackProviderId ?? null,
            fallbackExternalProductId: p.fallbackExternalProductId ?? null,
          })),
          qtyConfig: {
            unit: cfg?.unit ?? "وحدة",
            minQty: cfg ? displayAmount(cfg.minQty) : "1",
            maxQty: cfg?.maxQty ? displayAmount(cfg.maxQty) : "",
            pricePerUnit: cfg?.pricePerUnit ? displayAmount(cfg.pricePerUnit) : "",
            pricePer1000: cfg?.pricePer1000 ? displayAmount(cfg.pricePer1000) : "",
            traderPricePerUnit: cfg?.traderPricePerUnit
              ? displayAmount(cfg.traderPricePerUnit)
              : "",
            traderPricePer1000: cfg?.traderPricePer1000
              ? displayAmount(cfg.traderPricePer1000)
              : "",
            costPrice: cfg ? displayAmount(cfg.costPrice) : "0",
          },
          tiers: tiers.map((t) => ({
            id: t.id,
            minQty: displayAmount(t.minQty),
            maxQty: t.maxQty ? displayAmount(t.maxQty) : "",
            pricePerUnit: displayAmount(t.pricePerUnit),
          })),
        }}
      />
    </div>
  );
}
