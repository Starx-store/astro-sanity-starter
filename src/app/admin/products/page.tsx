import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/server/db";
import { products, categories } from "@/server/db/schema";
import { productStatusLabel } from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDeleteButton } from "@/components/admin/product-delete-button";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requirePagePermission(PERMISSIONS.productsEdit);

  const rows = await db
    .select({ p: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(products.sortOrder), asc(products.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="text-sm text-muted">إدارة منتجات المتجر وأسعارها.</p>
        </div>
        <Link href="/admin/products/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            منتج جديد
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">
              لا توجد منتجات بعد — أنشئ أول منتج.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                    <th className="px-4 py-3 font-medium">المنتج</th>
                    <th className="px-4 py-3 font-medium">التصنيف</th>
                    <th className="px-4 py-3 font-medium">النوع</th>
                    <th className="px-4 py-3 font-medium">التنفيذ</th>
                    <th className="px-4 py-3 font-medium">الحالة</th>
                    <th className="px-4 py-3 font-medium">الترتيب</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, categoryName }) => {
                    const st = productStatusLabel(p.status);
                    return (
                      <tr key={p.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.name}</p>
                          <p className="font-mono text-[11px] text-muted" dir="ltr">
                            /{p.slug}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted">{categoryName}</td>
                        <td className="px-4 py-3">
                          <Badge tone="neutral">
                            {p.type === "package" ? "بكجات" : "كمية"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={p.fulfillment === "manual" ? "info" : "gold"}>
                            {p.fulfillment === "manual" ? "يدوي" : "تلقائي"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted" dir="ltr">
                          {p.sortOrder}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/admin/products/${p.id}`}
                              className="text-sm font-medium text-gold hover:underline"
                            >
                              تعديل
                            </Link>
                            <ProductDeleteButton
                              productId={p.id}
                              productName={p.name}
                              compact
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
