import { desc, eq } from "drizzle-orm";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { orders, users, products } from "@/server/db/schema";
import { handleError } from "@/server/http";
import { displayAmount } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** حقل CSV آمن: يقتبس ويهرّب علامات الاقتباس، ويبطل حقن الصيغ (=,+,-,@). */
function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** تصدير الطلبات إلى CSV (يتطلب صلاحية orders.manage). */
export async function GET() {
  try {
    await requireApiPermission(PERMISSIONS.ordersManage);

    const rows = await db
      .select({
        orderNo: orders.orderNo,
        user: users.name,
        email: users.email,
        product: products.name,
        quantity: orders.quantity,
        total: orders.totalPrice,
        cost: orders.costPrice,
        status: orders.status,
        fulfillment: orders.fulfillment,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .innerJoin(products, eq(orders.productId, products.id))
      .orderBy(desc(orders.createdAt))
      .limit(5000);

    const header = [
      "order_no",
      "customer",
      "email",
      "product",
      "quantity",
      "total",
      "cost",
      "profit",
      "status",
      "fulfillment",
      "created_at",
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      const profit = (Number(r.total) - Number(r.cost)).toFixed(2);
      lines.push(
        [
          r.orderNo,
          r.user,
          r.email,
          r.product,
          r.quantity ? displayAmount(r.quantity) : "",
          displayAmount(r.total),
          displayAmount(r.cost),
          profit,
          r.status,
          r.fulfillment,
          r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        ]
          .map(csvCell)
          .join(","),
      );
    }
    // BOM لدعم العربية في Excel
    const csv = "﻿" + lines.join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="evo-orders-${Date.now()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
