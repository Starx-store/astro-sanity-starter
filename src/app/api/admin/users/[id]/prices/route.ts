import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import {
  customerPrices,
  products,
  productPackages,
} from "@/server/db/schema";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";
import { posAmountField } from "@/server/validation/catalog";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** أسعار خاصة لعميل محدد — تتقدّم على سعر التاجر وخصومات الباقات. */

const upsertSchema = z.object({
  productId: z.string().uuid("اختر منتجًا"),
  packageId: z.string().uuid().nullable().optional(),
  price: posAmountField,
  note: z.string().trim().max(200).optional(),
});

const deleteSchema = z.object({ priceId: z.string().uuid() });

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.usersManage);
    if (!isUuid(params.id)) return jsonError("المستخدم غير موجود.", 404);

    const rows = await db
      .select({
        price: customerPrices,
        productName: products.name,
        productType: products.type,
        packageName: productPackages.name,
      })
      .from(customerPrices)
      .innerJoin(products, eq(products.id, customerPrices.productId))
      .leftJoin(
        productPackages,
        eq(productPackages.id, customerPrices.packageId),
      )
      .where(eq(customerPrices.userId, params.id))
      .orderBy(asc(products.name));

    return jsonOk({ items: rows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireApiPermission(PERMISSIONS.usersManage);
    if (!isUuid(params.id)) return jsonError("المستخدم غير موجود.", 404);

    const parsed = await parseBody(req, upsertSchema);
    if (!parsed.success) return parsed.response;
    const { productId, price, note } = parsed.data;

    const [product] = await db
      .select({ id: products.id, type: products.type })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!product) return jsonError("المنتج غير موجود.", 404);

    // منتج البكجات يتطلب تحديد بكج يتبعه؛ منتج الكمية لا بكج له.
    let packageId: string | null = null;
    if (product.type === "package") {
      if (!parsed.data.packageId) {
        return jsonError("اختر البكج الذي ينطبق عليه السعر.", 422);
      }
      const [pkg] = await db
        .select({ id: productPackages.id })
        .from(productPackages)
        .where(
          and(
            eq(productPackages.id, parsed.data.packageId),
            eq(productPackages.productId, productId),
          ),
        )
        .limit(1);
      if (!pkg) return jsonError("البكج لا يتبع هذا المنتج.", 422);
      packageId = pkg.id;
    }

    // تحديث السعر القائم إن وُجد لنفس (العميل، المنتج، البكج).
    const existing = await db
      .select({ id: customerPrices.id })
      .from(customerPrices)
      .where(
        and(
          eq(customerPrices.userId, params.id),
          eq(customerPrices.productId, productId),
        ),
      );
    const match = existing.length
      ? (
          await db
            .select()
            .from(customerPrices)
            .where(
              and(
                eq(customerPrices.userId, params.id),
                eq(customerPrices.productId, productId),
              ),
            )
        ).find((r) => r.packageId === packageId)
      : undefined;

    if (match) {
      await db
        .update(customerPrices)
        .set({ price, note: note || null, updatedAt: new Date() })
        .where(eq(customerPrices.id, match.id));
      return jsonOk({ updated: true });
    }

    await db.insert(customerPrices).values({
      userId: params.id,
      productId,
      packageId,
      price,
      note: note || null,
      createdBy: admin.id,
    });
    return jsonOk({ created: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.usersManage);
    const parsed = await parseBody(req, deleteSchema);
    if (!parsed.success) return parsed.response;

    const deleted = await db
      .delete(customerPrices)
      .where(
        and(
          eq(customerPrices.id, parsed.data.priceId),
          eq(customerPrices.userId, params.id),
        ),
      )
      .returning({ id: customerPrices.id });
    if (deleted.length === 0) return jsonError("السعر غير موجود.", 404);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
