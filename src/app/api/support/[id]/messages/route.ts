import { requireApiUser } from "@/server/auth/api";
import { hasPermission, isStaffOrAdmin, PERMISSIONS } from "@/server/auth/rbac";
import { addTicketMessage } from "@/server/support/service";
import { ticketReplySchema } from "@/server/validation/support";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/** رد على تذكرة — العميل المالك، أو موظف بصلاحية support.manage. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireApiUser();
    if (!isUuid(params.id)) return jsonError("التذكرة غير موجودة.", 404);

    const parsed = await parseBody(req, ticketReplySchema);
    if (!parsed.success) return parsed.response;

    const asStaff =
      isStaffOrAdmin(user) &&
      (await hasPermission(user, PERMISSIONS.supportManage));

    await addTicketMessage({
      ticketId: params.id,
      user,
      body: parsed.data.body,
      asStaff,
    });
    return jsonOk({ sent: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}
