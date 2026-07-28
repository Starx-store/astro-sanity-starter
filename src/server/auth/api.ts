import "server-only";
import { headers } from "next/headers";
import { AppError } from "@/server/errors";
import { getSessionUser, type SessionUser } from "./session";
import { hasPermission, isStaffOrAdmin, type Permission } from "./rbac";

/**
 * حرّاس واجهات API (Route Handlers) — يرمون AppError بدل إعادة التوجيه،
 * فتتحوّل في handleError إلى استجابة JSON بالحالة الصحيحة.
 */

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError("unauthenticated", "يجب تسجيل الدخول.", 401);
  }
  if (user.status !== "active") {
    throw new AppError("account_disabled", "هذا الحساب موقوف.", 403);
  }
  return user;
}

/** يتطلب موظفًا/أدمن يملك الصلاحية المحددة (الأدمن يملكها ضمنيًا). */
export async function requireApiPermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireApiUser();
  if (!isStaffOrAdmin(user)) {
    throw new AppError("forbidden", "هذه العملية للإدارة فقط.", 403);
  }
  if (!(await hasPermission(user, permission))) {
    throw new AppError("forbidden", "لا تملك الصلاحية المطلوبة لهذه العملية.", 403);
  }
  return user;
}

/** عنوان IP الطالب (خلف بروكسي إن وجد) — للتدقيق. */
export async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}
