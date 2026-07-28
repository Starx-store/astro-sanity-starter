import { requireApiUser } from "@/server/auth/api";
import { markAllRead } from "@/server/notifications/service";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireApiUser();
    await markAllRead(user.id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
