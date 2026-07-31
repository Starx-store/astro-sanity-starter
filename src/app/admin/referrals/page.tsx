import { Users, UserPlus, Trophy, Sparkles } from "lucide-react";
import { db } from "@/server/db";
import { referrals, users as usersTable } from "@/server/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const referrerUser = alias(usersTable, "referrerUser");
  const referredUser = alias(usersTable, "referredUser");

  let items: any[] = [];
  let topReferrers: any[] = [];

  try {
    items = await db
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

    topReferrers = await db
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
  } catch (err) {
    console.error("Error loading admin referrals data:", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-gold" />
          سجل الإحالات والمسوقين
        </h1>
        <p className="mt-1 text-sm text-muted">
          متابعة تفصيلية للأشخاص الذين سجلوا عن طريق رابط الإحالة وقائمة المسوقين الأوائل.
        </p>
      </div>

      {/* ملخص كروت الإحصائيات */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="glass-card-pro border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted">
              إجمالي التسجيلات عبر الإحالة
            </CardTitle>
            <Users className="h-5 w-5 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{items.length}</div>
            <p className="text-xs text-muted mt-1">مستخدم قام بالتسجيل عبر رابط دعوة</p>
          </CardContent>
        </Card>

        <Card className="glass-card-pro border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-muted">
              عدد المسوقين النشطين
            </CardTitle>
            <Trophy className="h-5 w-5 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-400">{topReferrers.length}</div>
            <p className="text-xs text-muted mt-1">مسوّق قام بدعوة أشخاص بنجاح</p>
          </CardContent>
        </Card>
      </div>

      {/* جدول المسوقين الأوائل */}
      <Card className="glass-card-pro border-white/5">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gold" />
            أبرز المسوقين والمُحيلين (الأكثر دعوة)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topReferrers.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted">لا توجد إحالات بعد.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                    <th className="px-4 py-3 font-medium">اسم المسوق</th>
                    <th className="px-4 py-3 font-medium">البريد الإلكتروني</th>
                    <th className="px-4 py-3 font-medium text-center">عدد الإحالات</th>
                  </tr>
                </thead>
                <tbody>
                  {topReferrers.map((r, i) => (
                    <tr key={r.referrerId} className="border-b border-border/40 last:border-0 hover:bg-surface-2/30">
                      <td className="px-4 py-3 font-bold flex items-center gap-2">
                        {i === 0 && <Sparkles className="h-4 w-4 text-gold" />}
                        {r.referrerName}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{r.referrerEmail}</td>
                      <td className="px-4 py-3 text-center font-black text-gold">
                        <Badge tone="gold">{r.totalReferred} عميل</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* سجل التسجيلات والتفاصيل */}
      <Card className="glass-card-pro border-white/5">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            سجل جميع التسجيلات عبر الإحالة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted">لا يوجد سجل إحالات بعد.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                    <th className="px-4 py-3 font-medium">العميل المُسجّل</th>
                    <th className="px-4 py-3 font-medium">عن طريق المسوّق</th>
                    <th className="px-4 py-3 font-medium text-left">تاريخ التسجيل</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/30">
                      <td className="px-4 py-3">
                        <span className="block font-bold text-foreground">{row.referredName}</span>
                        <span className="text-[11px] text-muted">{row.referredEmail}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-semibold text-gold">{row.referrerName}</span>
                        <span className="text-[11px] text-muted">{row.referrerEmail}</span>
                      </td>
                      <td className="px-4 py-3 text-left text-xs text-muted">
                        {new Date(row.createdAt).toLocaleString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
