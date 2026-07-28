import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { updateTicketStatus } from "@/server/support/service";
import { ticketStatusSchema } from "@/server/validation/support";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireApiPermission(PERMISSIONS.supportManage);
    if (!isUuid(params.id)) return jsonError("التذكرة غير موجودة.", 404);

    const parsed = await parseBody(req, ticketStatusSchema);
    if (!parsed.success) return parsed.response;

    await updateTicketStatus({
      ticketId: params.id,
      status: parsed.data.status,
      adminId: admin.id,
    });
    return jsonOk({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}
