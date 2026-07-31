import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { referrals, referralEarnings, users as usersTable } from "@/server/db/schema";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { handleError, jsonOk } from "@/server/http";
import { alias } from "drizzle-orm/pg-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiPermission(PERMISSIONS.usersView);

    const referrerUser = alias(usersTable, "referrerUser");
    const referredUser = alias(usersTable, "referredUser");

    // قائمة جميع عمليات الإحالة والتسجيل
    const items = await db
      .select({
        id: referrals.id,
        createdAt: referrals.createdAt,
        referrerId: referrerUser.id,
        referrerName: referrerUser.name,
        referrerEmail: referrerUser.email,
        referredId: referredUser.id,
        referredName: referredUser.name,
        referredEmail: referredUser.email,
      })
      .from(referrals)
      .innerJoin(referrerUser, eq(referrals.referrerId, referrerUser.id))
      .innerJoin(referredUser, eq(referrals.referredId, referredUser.id))
      .orderBy(desc(referrals.createdAt))
      .limit(300);

    // تجميع إحصائيات المسوقين الأوائل
    const topReferrers = await db
      .select({
        referrerId: referrerUser.id,
        referrerName: referrerUser.name,
        referrerEmail: referrerUser.email,
        totalReferred: sql<number>`count(${referrals.id})::int`,
      })
      .from(referrals)
      .innerJoin(referrerUser, eq(referrals.referrerId, referrerUser.id))
      .groupBy(referrerUser.id, referrerUser.name, referrerUser.email)
      .orderBy(desc(sql`count(${referrals.id})`))
      .limit(50);

    return jsonOk({
      referrals: items,
      topReferrers,
    });
  } catch (err) {
    return handleError(err);
  }
}
