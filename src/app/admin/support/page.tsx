import Link from "next/link";
import { desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { supportTickets, users } from "@/server/db/schema";
import { formatDate, cn } from "@/lib/utils";
import {
  ticketStatusLabel,
  departmentLabel,
  priorityLabel,
  TICKET_STATUS_LABELS,
} from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

const FILTERS = ["new", "in_progress", "awaiting_customer", "closed"] as const;

export default async function AdminSupportPage(
  props: {
    searchParams: Promise<{ status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requirePagePermission(PERMISSIONS.supportManage);

  const status = FILTERS.find((s) => s === searchParams.status);

  const counts = await db
    .select({ status: supportTickets.status, count: sql<number>`count(*)::int` })
    .from(supportTickets)
    .groupBy(supportTickets.status);
  const countOf = (s: string) => counts.find((c) => c.status === s)?.count ?? 0;
  const open = counts
    .filter((c) => c.status !== "closed")
    .reduce((a, c) => a + c.count, 0);

  const rows = await db
    .select({ t: supportTickets, userName: users.name })
    .from(supportTickets)
    .innerJoin(users, eq(supportTickets.userId, users.id))
    .where(status ? eq(supportTickets.status, status) : ne(supportTickets.status, "closed"))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الدعم</h1>
        <p className="text-sm text-muted">تذاكر العملاء والردود.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/support"
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm",
            !status
              ? "border-gold/50 bg-gold/15 text-gold"
              : "border-border text-muted hover:text-foreground",
          )}
        >
          المفتوحة ({open})
        </Link>
        {FILTERS.map((s) => (
          <Link
            key={s}
            href={`/admin/support?status=${s}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm",
              status === s
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {TICKET_STATUS_LABELS[s]?.label} ({countOf(s)})
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">لا تذاكر.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                    <th className="px-4 py-3 font-medium">رقم التذكرة</th>
                    <th className="px-4 py-3 font-medium">العميل</th>
                    <th className="px-4 py-3 font-medium">القسم</th>
                    <th className="px-4 py-3 font-medium">الأولوية</th>
                    <th className="px-4 py-3 font-medium">الحالة</th>
                    <th className="px-4 py-3 font-medium">آخر تحديث</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ t, userName }) => {
                    const st = ticketStatusLabel(t.status);
                    const pr = priorityLabel(t.priority);
                    return (
                      <tr key={t.id} className="border-b border-border/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs" dir="ltr">
                          {t.ticketNo}
                        </td>
                        <td className="px-4 py-3">{userName}</td>
                        <td className="px-4 py-3 text-muted">
                          {departmentLabel(t.department ?? "general")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={pr.tone}>{pr.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                          {formatDate(t.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/support/${t.id}`}
                            className="text-sm font-medium text-gold hover:underline"
                          >
                            فتح
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
