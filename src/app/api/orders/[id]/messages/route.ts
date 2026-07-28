import { requireApiUser } from "@/server/auth/api";
import { hasPermission, isStaffOrAdmin, PERMISSIONS } from "@/server/auth/rbac";
import { addOrderMessage } from "@/server/orders/service";
import { orderMessageSchema } from "@/server/validation/orders";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/** إرسال رسالة داخل الطلب — العميل المالك، أو موظف بصلاحية orders.manage. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireApiUser();
    if (!isUuid(params.id)) return jsonError("الطلب غير موجود.", 404);

    const parsed = await parseBody(req, orderMessageSchema);
    if (!parsed.success) return parsed.response;

    const asStaff =
      isStaffOrAdmin(user) &&
      (await hasPermission(user, PERMISSIONS.ordersManage));

    await addOrderMessage({
      orderId: params.id,
      user,
      body: parsed.data.body,
      asStaff,
    });

    return jsonOk({ sent: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}
