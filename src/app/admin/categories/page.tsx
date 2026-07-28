import { asc } from "drizzle-orm";
import { db } from "@/server/db";
import { categories } from "@/server/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryManager } from "@/components/admin/category-manager";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requirePagePermission(PERMISSIONS.productsEdit);

  const cats = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">التصنيفات</h1>
        <p className="text-sm text-muted">
          نظّم منتجات المتجر في تصنيفات — التصنيف المخفي لا يظهر للعملاء.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <CategoryManager
            categories={cats.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              sortOrder: c.sortOrder,
              isVisible: c.isVisible,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
