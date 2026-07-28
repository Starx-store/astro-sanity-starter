import { requireApiUser } from "@/server/auth/api";
import { listNotifications, unreadCount } from "@/server/notifications/service";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

/** قائمة إشعارات المستخدم + عدد غير المقروء. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const [items, unread] = await Promise.all([
      listNotifications(user.id),
      unreadCount(user.id),
    ]);
    return jsonOk({
      unread,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.readAt,
        createdAt: n.createdAt,
        metadata: n.metadata as Record<string, unknown> | null,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
