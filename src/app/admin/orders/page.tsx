import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { orders, users, products } from "@/server/db/schema";
import { displayAmount } from "@/lib/money";
import { formatDate, cn } from "@/lib/utils";
import { orderStatusLabel, ORDER_STATUS_LABELS } from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

const FILTERS = [
  "under_review",
  "needs_info",
  "in_progress",
  "completed",
  "refunded",
] as const;

export default async function AdminOrdersPage(
  props: {
    searchParams: Promise<{ status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requirePagePermission(PERMISSIONS.ordersManage);

  const status = FILTERS.find((s) => s === searchParams.status);

  const counts = await db
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.status);
  const countOf = (s: string) => counts.find((c) => c.status === s)?.count ?? 0;
  const total = counts.reduce((a, c) => a + c.count, 0);

  const rows = await db
    .select({ o: orders, userName: users.name, productName: products.name })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .innerJoin(products, eq(orders.productId, products.id))
    .where(status ? eq(orders.status, status) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-sm text-muted">إدارة الطلبات وتنفيذها يدويًا.</p>
        </div>
        <Link
          href="/api/admin/reports/export?type=orders"
          target="_blank"
          className="inline-flex h-9 items-center justify-center rounded-md bg-gold px-4 py-2 text-sm font-medium text-black shadow transition-colors hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
        >
          تصدير التقرير (CSV)
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm",
            !status
              ? "border-gold/50 bg-gold/15 text-gold"
              : "border-border text-muted hover:text-foreground",
          )}
        >
          الكل ({total})
        </Link>
        {FILTERS.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm",
              status === s
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {ORDER_STATUS_LABELS[s]?.label ?? s} ({countOf(s)})
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">لا توجد طلبات.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                    <th className="px-4 py-3 font-medium">رقم الطلب</th>
                    <th className="px-4 py-3 font-medium">العميل</th>
                    <th className="px-4 py-3 font-medium">المنتج</th>
                    <th className="px-4 py-3 font-medium">الإجمالي</th>
                    <th className="px-4 py-3 font-medium">الحالة</th>
                    <th className="px-4 py-3 font-medium">التاريخ</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ o, userName, productName }) => {
                    const st = orderStatusLabel(o.status);
                    return (
                      <tr key={o.id} className="border-b border-border/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs" dir="ltr">
                          {o.orderNo}
                        </td>
                        <td className="px-4 py-3">{userName}</td>
                        <td className="px-4 py-3">{productName}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold" dir="ltr">
                          {displayAmount(o.totalPrice)}$
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                          {formatDate(o.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="text-sm font-medium text-gold hover:underline"
                          >
                            إدارة
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
