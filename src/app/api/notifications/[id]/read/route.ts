import { requireApiUser } from "@/server/auth/api";
import { markRead } from "@/server/notifications/service";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireApiUser();
    if (!isUuid(params.id)) return jsonError("الإشعار غير موجود.", 404);
    await markRead(user.id, params.id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
