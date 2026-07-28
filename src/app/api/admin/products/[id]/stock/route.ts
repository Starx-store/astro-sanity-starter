import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import {
  productStockItems,
  productPackages,
  products,
} from "@/server/db/schema";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** إدارة مخزون التسليم الفوري (أكواد/حسابات) لمنتج. */

const addSchema = z.object({
  // كل سطر غير فارغ = عنصر مخزون واحد (كود/حساب).
  lines: z.string().min(1, "أدخل الأكواد").max(200_000),
  packageId: z.string().uuid().nullable().optional(),
});

const deleteSchema = z.object({ itemId: z.string().uuid() });

async function ensureProduct(id: string) {
  if (!isUuid(id)) return null;
  const [p] = await db
    .select({ id: products.id, type: products.type })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return p ?? null;
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.productsEdit);
    const product = await ensureProduct(params.id);
    if (!product) return jsonError("المنتج غير موجود.", 404);

    const items = await db
      .select()
      .from(productStockItems)
      .where(eq(productStockItems.productId, params.id))
      .orderBy(
        asc(productStockItems.status),
        desc(productStockItems.createdAt),
      )
      .limit(500);

    const available = items.filter((i) => i.status === "available").length;
    const sold = items.filter((i) => i.status === "sold").length;
    return jsonOk({ items, available, sold });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.productsEdit);
    const product = await ensureProduct(params.id);
    if (!product) return jsonError("المنتج غير موجود.", 404);

    const parsed = await parseBody(req, addSchema);
    if (!parsed.success) return parsed.response;

    // اتساق البيع: منتج البكجات يبيع عناصر مربوطة ببكج من نفس المنتج فقط،
    // ومنتج الكمية يبيع العناصر العامة (بلا بكج) فقط — وإلا صار المخزون
    // «متاحًا» في العرض وغير قابل للبيع في الطلبات.
    let packageId: string | null = null;
    if (product.type === "package") {
      if (!parsed.data.packageId) {
        return jsonError("اختر البكج الذي تتبعه هذه العناصر.", 422);
      }
      const [pkg] = await db
        .select({ id: productPackages.id })
        .from(productPackages)
        .where(
          and(
            eq(productPackages.id, parsed.data.packageId),
            eq(productPackages.productId, params.id),
          ),
        )
        .limit(1);
      if (!pkg) return jsonError("البكج لا يتبع هذا المنتج.", 422);
      packageId = pkg.id;
    }

    const lines = parsed.data.lines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return jsonError("لا توجد أسطر صالحة.", 422);
    if (lines.length > 1000) {
      return jsonError("حد الإضافة الواحدة 1000 عنصر.", 422);
    }

    await db.insert(productStockItems).values(
      lines.map((content) => ({
        productId: params.id,
        packageId,
        content,
      })),
    );
    return jsonOk({ added: lines.length }, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.productsEdit);
    const parsed = await parseBody(req, deleteSchema);
    if (!parsed.success) return parsed.response;

    // لا يُحذف إلا المتاح — المُباع سجل تسليم للعميل.
    const deleted = await db
      .delete(productStockItems)
      .where(
        and(
          eq(productStockItems.id, parsed.data.itemId),
          eq(productStockItems.productId, params.id),
          eq(productStockItems.status, "available"),
        ),
      )
      .returning({ id: productStockItems.id });
    if (deleted.length === 0) {
      return jsonError("العنصر غير موجود أو سبق بيعه.", 404);
    }
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
