import Link from "next/link";
import { asc } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/server/db";
import { categories, providers } from "@/server/db/schema";
import { ProductForm } from "@/components/admin/product-form";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePagePermission(PERMISSIONS.productsEdit);

  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const provs = await db
    .select({ id: providers.id, name: providers.name })
    .from(providers)
    .where(eq(providers.status, "active"))
    .orderBy(asc(providers.name));

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        كل المنتجات
      </Link>
      <h1 className="text-2xl font-bold">منتج جديد</h1>

      <ProductForm
        isNew
        categories={cats}
        providers={provs}
        initial={{
          name: "",
          slug: "",
          categoryId: cats[0]?.id ?? "",
          type: "package",
          fulfillment: "manual",
          status: "hidden",
          traderOnly: false,
          imageId: null,
          description: "",
          executionTime: "",
          terms: "",
          warranty: "",
          sortOrder: 0,
          requiredFields: [],
          packages: [],
          qtyConfig: {
            unit: "وحدة",
            minQty: "1",
            maxQty: "",
            pricePerUnit: "",
            pricePer1000: "",
            traderPricePerUnit: "",
            traderPricePer1000: "",
            costPrice: "0",
          },
          tiers: [],
        }}
      />
    </div>
  );
}
