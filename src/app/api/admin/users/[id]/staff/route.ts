import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users, staffPermissions, auditLogs } from "@/server/db/schema";
import { requireApiUser } from "@/server/auth/api";
import { PERMISSIONS, isAdmin, type Permission } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL = Object.values(PERMISSIONS) as Permission[];

const schema = z.object({
  role: z.enum(["customer", "staff"]),
  permissions: z.array(z.enum(ALL as [Permission, ...Permission[]])).default([]),
});

/**
 * إدارة دور الموظف وصلاحياته الدقيقة — للأدمن فقط (لا يكفي users.manage:
 * منح الصلاحيات تصعيد امتياز، فنقصره على الأدمن).
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const viewer = await requireApiUser();
    if (!isAdmin(viewer)) {
      throw new AppError("forbidden", "هذه العملية للأدمن فقط.", 403);
    }
    if (!isUuid(params.id)) return jsonError("المستخدم غير موجود.", 404);

    const [target] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1);
    if (!target) return jsonError("المستخدم غير موجود.", 404);

    const rows = await db
      .select({ permission: staffPermissions.permission })
      .from(staffPermissions)
      .where(eq(staffPermissions.userId, params.id));

    return jsonOk({
      role: target.role,
      permissions: rows.map((r) => r.permission),
      all: ALL,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const viewer = await requireApiUser();
    if (!isAdmin(viewer)) {
      throw new AppError("forbidden", "هذه العملية للأدمن فقط.", 403);
    }
    if (!isUuid(params.id)) return jsonError("المستخدم غير موجود.", 404);
    if (params.id === viewer.id) {
      return jsonError("لا يمكنك تغيير صلاحيات حسابك.", 409);
    }

    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;

    const [target] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1);
    if (!target) return jsonError("المستخدم غير موجود.", 404);
    if (target.role === "admin") {
      return jsonError("لا تُدار صلاحيات الأدمن من هنا.", 409);
    }

    const wanted = Array.from(new Set(parsed.data.permissions));

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ role: parsed.data.role, updatedAt: new Date() })
        .where(eq(users.id, params.id));

      const current = await tx
        .select({ permission: staffPermissions.permission })
        .from(staffPermissions)
        .where(eq(staffPermissions.userId, params.id));
      const currentSet = new Set(current.map((c) => c.permission));

      // إزالة ما لم يُطلب.
      const toRemove = current
        .map((c) => c.permission)
        .filter((p) => !wanted.includes(p as Permission));
      if (toRemove.length > 0) {
        await tx
          .delete(staffPermissions)
          .where(
            and(
              eq(staffPermissions.userId, params.id),
              inArray(staffPermissions.permission, toRemove),
            ),
          );
      }

      // إضافة الجديد. عميل بلا دور موظف لا يحتفظ بأي صلاحية.
      const toAdd =
        parsed.data.role === "staff"
          ? wanted.filter((p) => !currentSet.has(p))
          : [];
      if (toAdd.length > 0) {
        await tx
          .insert(staffPermissions)
          .values(toAdd.map((permission) => ({ userId: params.id, permission })));
      }
      if (parsed.data.role !== "staff") {
        await tx
          .delete(staffPermissions)
          .where(eq(staffPermissions.userId, params.id));
      }

      await tx.insert(auditLogs).values({
        actorId: viewer.id,
        action: "user.staff_permissions",
        entityType: "user",
        entityId: params.id,
        before: { role: target.role, permissions: current.map((c) => c.permission) },
        after: { role: parsed.data.role, permissions: wanted },
      });
    });

    return jsonOk({ saved: true });
  } catch (err) {
    return handleError(err);
  }
}
