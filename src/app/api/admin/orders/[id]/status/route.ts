import { requireApiPermission, getRequestIp } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { adminUpdateOrderStatus } from "@/server/orders/service";
import { adminOrderStatusSchema } from "@/server/validation/orders";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/** تغيير حالة الطلب (تنفيذ/معلومات/إكمال مع تسوية/استرجاع) — orders.manage. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireApiPermission(PERMISSIONS.ordersManage);
    if (!isUuid(params.id)) return jsonError("الطلب غير موجود.", 404);

    const parsed = await parseBody(req, adminOrderStatusSchema);
    if (!parsed.success) return parsed.response;

    await adminUpdateOrderStatus({
      orderId: params.id,
      adminId: admin.id,
      to: parsed.data.to,
      note: parsed.data.note,
      deliveryText: parsed.data.deliveryText,
      ip: await getRequestIp(),
    });

    return jsonOk({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}
