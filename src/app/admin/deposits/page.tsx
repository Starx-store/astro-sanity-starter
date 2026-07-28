import Link from "next/link";
import { desc, asc, eq, inArray } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db } from "@/server/db";
import { depositRequests, users } from "@/server/db/schema";
import { displayAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { depositStatusLabel, depositMethodLabel } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepositReview } from "@/components/admin/deposit-review";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AdminDepositsPage() {
  await requirePagePermission(PERMISSIONS.depositsReview);

  const pending = await db
    .select({
      d: depositRequests,
      userName: users.name,
      userEmail: users.email,
    })
    .from(depositRequests)
    .innerJoin(users, eq(depositRequests.userId, users.id))
    .where(eq(depositRequests.status, "pending"))
    .orderBy(asc(depositRequests.createdAt))
    .limit(50);

  const reviewed = await db
    .select({
      d: depositRequests,
      userName: users.name,
    })
    .from(depositRequests)
    .innerJoin(users, eq(depositRequests.userId, users.id))
    .where(inArray(depositRequests.status, ["completed", "rejected"]))
    .orderBy(desc(depositRequests.updatedAt))
    .limit(10);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">طلبات الشحن</h1>
          <p className="text-sm text-muted">
            راجع الإثبات ثم اعتمد الطلب (يضيف الرصيد فورًا) أو ارفضه بسبب.
          </p>
        </div>
        <Link
          href="/api/admin/reports/export?type=deposits"
          target="_blank"
          className="inline-flex h-9 items-center justify-center rounded-md bg-gold px-4 py-2 text-sm font-medium text-black shadow transition-colors hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold"
        >
          تصدير التقرير (CSV)
        </Link>
      </div>

      {/* قيد المراجعة */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">
          بانتظار المراجعة{" "}
          <span className="text-sm font-normal text-muted">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
            لا توجد طلبات معلّقة. 🎉
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map(({ d, userName, userEmail }) => {
              const method = depositMethodLabel(d.method);
              return (
                <Card key={d.id}>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{userName}</p>
                        <p className="text-xs text-muted" dir="ltr">
                          {userEmail}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-2xl font-extrabold text-gradient-gold" dir="ltr">
                          {displayAmount(d.amount)}$
                        </p>
                        <Badge tone={method.tone} className="mt-1">
                          {method.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-muted">
                      <span>{formatDate(d.createdAt)}</span>
                      {d.proofFileId ? (
                        <Link
                          href={`/api/files/${d.proofFileId}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 font-medium text-gold hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          عرض الإثبات
                        </Link>
                      ) : (
                        <span>بدون إثبات</span>
                      )}
                    </div>
                    {d.method === "binance" ? (
                      <p className="rounded-lg border border-dashed border-gold/30 bg-gold/5 p-3 text-xs text-muted">
                        إيداع تلقائي عبر Binance Pay — يُعتمد فور تأكيد الدفع
                        دون مراجعة يدوية (بانتظار الدفع: {d.externalStatus ?? "—"}).
                      </p>
                    ) : (
                      <DepositReview depositId={d.id} />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* آخر المراجعات */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">آخر المراجعات</h2>
        <Card>
          <CardHeader className="sr-only">
            <CardTitle>آخر المراجعات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {reviewed.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">لا شيء بعد.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {reviewed.map(({ d, userName }) => {
                    const st = depositStatusLabel(d.status);
                    return (
                      <tr key={d.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3">{userName}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold" dir="ltr">
                          {displayAmount(d.amount)}$
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                          {formatDate(d.updatedAt)}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted">
                          {d.rejectReason ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
