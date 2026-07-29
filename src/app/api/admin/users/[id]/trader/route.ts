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

/** تفعيل/إلغاء باقة العضوية وتغيير رتبة المستخدم (عادي، فضي، ذهبي، ماسي). */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireApiPermission(PERMISSIONS.usersManage);
    if (!isUuid(params.id)) return jsonError("المستخدم غير موجود.", 404);

    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;

    let tier = parsed.data.membershipTier;
    let isTrader = parsed.data.isTrader;

    if (tier) {
      isTrader = tier !== "standard";
    } else if (typeof isTrader === "boolean") {
      tier = isTrader ? "gold" : "standard";
    } else {
      tier = "standard";
      isTrader = false;
    }

    const [updated] = await db
      .update(users)
      .set({
        isTrader,
        membershipTier: tier,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.id))
      .returning({ id: users.id, isTrader: users.isTrader, membershipTier: users.membershipTier });
    if (!updated) return jsonError("المستخدم غير موجود.", 404);

    await db.insert(auditLogs).values({
      actorId: admin.id,
      action: `user.tier_updated:${tier}`,
      entityType: "user",
      entityId: params.id,
    });

    return jsonOk({ isTrader: updated.isTrader, membershipTier: updated.membershipTier });
  } catch (err) {
    return handleError(err);
  }
}
