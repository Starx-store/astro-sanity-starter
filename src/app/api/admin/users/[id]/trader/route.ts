import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users, auditLogs } from "@/server/db/schema";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

const schema = z.object({
  isTrader: z.boolean().optional(),
  membershipTier: z.enum(["standard", "silver", "gold", "platinum"]).optional(),
});

/** تحديث حالة التاجر وباقة العضوية بشكل مستقل تماماً. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireApiPermission(PERMISSIONS.usersManage);
    if (!isUuid(params.id)) return jsonError("المستخدم غير موجود.", 404);

    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;

    const updateFields: Record<string, any> = { updatedAt: new Date() };

    if (typeof parsed.data.isTrader === "boolean") {
      updateFields.isTrader = parsed.data.isTrader;
    }
    if (parsed.data.membershipTier) {
      updateFields.membershipTier = parsed.data.membershipTier;
    }

    const [updated] = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, params.id))
      .returning({ id: users.id, isTrader: users.isTrader, membershipTier: users.membershipTier });
    if (!updated) return jsonError("المستخدم غير موجود.", 404);

    await db.insert(auditLogs).values({
      actorId: admin.id,
      action: `user.profile_updated:${params.id}`,
      entityType: "user",
      entityId: params.id,
    });

    return jsonOk({ isTrader: updated.isTrader, membershipTier: updated.membershipTier });
  } catch (err) {
    return handleError(err);
  }
}
