import Link from "next/link";
import { desc, eq, ilike, or } from "drizzle-orm";
import { Search } from "lucide-react";
import { db } from "@/server/db";
import { users, wallets } from "@/server/db/schema";
import { displayAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  customer: "عميل",
  staff: "موظف",
  admin: "أدمن",
};

export default async function AdminUsersPage(
  props: {
    searchParams: Promise<{ q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requirePagePermission(PERMISSIONS.usersManage);

  const q = searchParams.q?.trim() ?? "";

  const rows = await db
    .select({ u: users, balance: wallets.balance, held: wallets.heldBalance })
    .from(users)
    .leftJoin(wallets, eq(wallets.userId, users.id))
    .where(
      q
        ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المستخدمون</h1>
        <p className="text-sm text-muted">
          ابحث بالاسم أو البريد، وافتح المستخدم لإدارة محفظته.
        </p>
      </div>

      <form className="flex max-w-md gap-2" action="/admin/users">
        <Input
          name="q"
          defaultValue={q}
          placeholder="بحث بالاسم أو البريد..."
        />
        <Button type="submit" variant="subtle" size="md">
          <Search className="h-4 w-4" />
          بحث
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              لا نتائج{q ? ` لـ "${q}"` : ""}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                    <th className="px-4 py-3 font-medium">الاسم</th>
                    <th className="px-4 py-3 font-medium">البريد</th>
                    <th className="px-4 py-3 font-medium">الدور</th>
                    <th className="px-4 py-3 font-medium">الحالة</th>
                    <th className="px-4 py-3 font-medium">الرصيد</th>
                    <th className="px-4 py-3 font-medium">التسجيل</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ u, balance }) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-muted" dir="ltr">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge tone={u.role === "customer" ? "neutral" : "gold"}>
                            {ROLE_LABELS[u.role] ?? u.role}
                          </Badge>
                          {u.membershipTier === "platinum" ? (
                            <Badge tone="gold">💎 ماسية VIP</Badge>
                          ) : u.membershipTier === "gold" || u.isTrader ? (
                            <Badge tone="gold">🥇 ذهبية</Badge>
                          ) : u.membershipTier === "silver" ? (
                            <Badge tone="neutral">🥈 فضية</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.status === "active" ? "success" : "danger"}>
                          {u.status === "active" ? "نشط" : u.status}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold" dir="ltr">
                        {displayAmount(balance ?? "0")}$
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="text-sm font-medium text-gold hover:underline"
                        >
                          إدارة
                        </Link>
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
