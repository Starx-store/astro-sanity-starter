import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { staffPermissions } from "@/server/db/schema";
import type { SessionUser } from "./session";

/**
 * صلاحيات الموظفين الدقيقة. الأدمن يملك كل الصلاحيات ضمنيًا.
 */
export const PERMISSIONS = {
  ordersManage: "orders.manage",
  walletAdjust: "wallet.adjust",
  productsEdit: "products.edit",
  providersManage: "providers.manage",
  usersManage: "users.manage",
  depositsReview: "deposits.review",
  supportManage: "support.manage",
  settingsEdit: "settings.edit",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function isAdmin(user: Pick<SessionUser, "role">): boolean {
  return user.role === "admin";
}

export function isStaffOrAdmin(user: Pick<SessionUser, "role">): boolean {
  return user.role === "admin" || user.role === "staff";
}

/** هل يملك المستخدم صلاحية معيّنة؟ الأدمن دائمًا نعم. */
export async function hasPermission(
  user: Pick<SessionUser, "id" | "role">,
  permission: Permission,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role !== "staff") return false;

  const rows = await db
    .select({ id: staffPermissions.id })
    .from(staffPermissions)
    .where(
      and(
        eq(staffPermissions.userId, user.id),
        eq(staffPermissions.permission, permission),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
