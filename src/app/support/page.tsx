import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { orders } from "@/server/db/schema";
import { listUserTickets } from "@/server/support/service";
import { formatDate } from "@/lib/utils";
import { ticketStatusLabel, departmentLabel, priorityLabel } from "@/lib/labels";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewTicketForm } from "@/components/support/new-ticket-form";
import { getLocale } from "@/server/locale";

import { getSetting } from "@/server/settings/service";
import { Alert } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    title: "الدعم",
    myTickets: "تذاكري",
    empty: "لا توجد تذاكر بعد.",
    newTicket: "تذكرة جديدة",
  },
  en: {
    title: "Support",
    myTickets: "My Tickets",
    empty: "No tickets yet.",
    newTicket: "New Ticket",
  },
} as const;

export default async function SupportPage() {
  const isSupportEnabled = (await getSetting<boolean>("feature.support_enabled", true)) !== false;
  if (!isSupportEnabled) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <SiteHeader />
        <main className="flex-1 mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
          <Alert tone="warning" className="justify-center text-base p-6">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <span>صفحة الدعم الفني معطّلة حالياً بقرار من الإدارة.</span>
          </Alert>
          <Link href="/" className="inline-block text-sm text-gold hover:underline font-bold">
            العودة للصفحة الرئيسية ←
          </Link>
        </main>
      </div>
    );
  }

  const user = await requireUser();
  const locale = await getLocale();
  const t = T[locale];
  const [tickets, recentOrders] = await Promise.all([
    listUserTickets(user.id),
    db
      .select({ id: orders.id, orderNo: orders.orderNo })
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(20),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold">{t.title}</h1>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <h2 className="mb-3 text-lg font-bold">{t.myTickets}</h2>
            {tickets.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted">
                  {t.empty}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tickets.map((tk) => {
                  const st = ticketStatusLabel(tk.status, locale);
                  const pr = priorityLabel(tk.priority, locale);
                  return (
                    <Link key={tk.id} href={`/support/${tk.id}`}>
                      <Card className="p-4 transition-colors hover:border-gold/40">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs text-muted" dir="ltr">
                              {tk.ticketNo}
                            </p>
                            <p className="mt-1 font-medium">
                              {departmentLabel(tk.department ?? "general", locale)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge tone={st.tone}>{st.label}</Badge>
                            <span className="text-[11px] text-muted">
                              {formatDate(tk.updatedAt)}
                            </span>
                          </div>
                        </div>
                        {tk.priority === "high" && (
                          <Badge tone={pr.tone} className="mt-2">
                            {pr.label}
                          </Badge>
                        )}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.newTicket}</CardTitle>
              </CardHeader>
              <CardContent>
                <NewTicketForm orders={recentOrders} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
