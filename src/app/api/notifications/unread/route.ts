import { getSessionUser } from "@/server/auth/session";
import { unreadCount } from "@/server/notifications/service";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

/** عدّاد غير المقروء فقط — خفيف، للاستطلاع الدوري من الجرس. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonOk({ unread: 0 });
    return jsonOk({ unread: await unreadCount(user.id) });
  } catch (err) {
    return handleError(err);
  }
}
