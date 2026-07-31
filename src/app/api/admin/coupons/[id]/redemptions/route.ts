import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  discountRedemptions,
  users as usersTable,
  orders as ordersTable,
} from "@/server/db/schema";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { handleError, jsonOk, jsonError } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    if (!isUuid(params.id)) return jsonError("الكوبون غير موجود.", 404);

    const rows = await db
      .select({
        id: discountRedemptions.id,
        amountOff: discountRedemptions.amountOff,
        createdAt: discountRedemptions.createdAt,
        userId: usersTable.id,
        userName: usersTable.name,
        userEmail: usersTable.email,
        orderId: ordersTable.id,
        orderNo: ordersTable.orderNo,
      })
      .from(discountRedemptions)
      .innerJoin(usersTable, eq(discountRedemptions.userId, usersTable.id))
      .leftJoin(ordersTable, eq(discountRedemptions.orderId, ordersTable.id))
      .where(eq(discountRedemptions.codeId, params.id))
      .orderBy(desc(discountRedemptions.createdAt))
      .limit(500);

    return jsonOk({ redemptions: rows });
  } catch (err) {
    return handleError(err);
  }
}
