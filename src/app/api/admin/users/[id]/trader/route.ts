import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users, auditLogs } from "@/server/db/schema";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

const schema = z.object({ isTrader: z.boolean() });

/** تفعيل/إلغاء باقة التاجر لمستخدم — يمنحه الأسعار الخاصة بالتجار. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireApiPermission(PERMISSIONS.usersManage);
    if (!isUuid(params.id)) return jsonError("المستخدم غير موجود.", 404);

    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;

    const [updated] = await db
      .update(users)
      .set({ isTrader: parsed.data.isTrader, updatedAt: new Date() })
      .where(eq(users.id, params.id))
      .returning({ id: users.id, isTrader: users.isTrader });
    if (!updated) return jsonError("المستخدم غير موجود.", 404);

    await db.insert(auditLogs).values({
      actorId: admin.id,
      action: parsed.data.isTrader ? "user.trader_enabled" : "user.trader_disabled",
      entityType: "user",
      entityId: params.id,
    });

    return jsonOk({ isTrader: updated.isTrader });
  } catch (err) {
    return handleError(err);
  }
}
