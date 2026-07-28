import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { notifications, users } from "@/server/db/schema";

/**
 * إرسال إشعار جماعي لكل المستخدمين النشطين.
 * يُنشئ صفًا واحدًا لكل مستخدم في جدول الإشعارات.
 */
export async function broadcastNotification(input: {
  title: string;
  body: string;
  type?: string;
}): Promise<number> {
  // Fetch all active user IDs
  const activeUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.status, "active"));

  if (activeUsers.length === 0) return 0;

  // Batch insert notifications (chunks of 500 to avoid huge queries)
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < activeUsers.length; i += CHUNK) {
    const chunk = activeUsers.slice(i, i + CHUNK);
    await db.insert(notifications).values(
      chunk.map((u) => ({
        userId: u.id,
        type: input.type ?? "broadcast",
        title: input.title,
        body: input.body || null,
        channel: "in_app" as const,
      })),
    );
    total += chunk.length;
  }
  return total;
}
