import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";
import { hasPermission, type Permission } from "./rbac";

/** إرجاع المستخدم الحالي أو null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

/** يفرض وجود مستخدم مسجّل، وإلا يعيد التوجيه لصفحة الدخول. */
export async function requireUser(
  redirectTo = "/login",
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(redirectTo);
  return user;
}

/** يفرض دورًا معيّنًا (staff/admin) للوصول للوحة الإدارة. */
export async function requireRole(
  roles: Array<SessionUser["role"]>,
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/**
 * يفرض صلاحية دقيقة على صفحة إدارة — لا يكفي دور الموظف.
 * بدونه يرى أي موظف بيانات صفحات لا تخصّه (أرصدة، بريد العملاء، إيداعات).
 */
export async function requirePagePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireRole(["admin", "staff"]);
  if (!(await hasPermission(user, permission))) redirect("/admin");
  return user;
}
