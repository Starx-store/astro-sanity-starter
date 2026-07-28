import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { getTicketAdmin } from "@/server/support/service";
import { formatDate, isUuid } from "@/lib/utils";
import {
  ticketStatusLabel,
  departmentLabel,
  priorityLabel,
} from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TicketThread } from "@/components/support/ticket-thread";
import { TicketStatusControl } from "@/components/admin/ticket-status-control";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AdminTicketPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  await requirePagePermission(PERMISSIONS.supportManage);

  if (!isUuid(params.id)) notFound();
  const data = await getTicketAdmin(params.id);
  if (!data) notFound();
  const { ticket, messages } = data;

  const [customer] = await db
    .select({ name: users.name, email: users.email, id: users.id })
    .from(users)
    .where(eq(users.id, ticket.userId))
    .limit(1);

  const st = ticketStatusLabel(ticket.status);
  const pr = priorityLabel(ticket.priority);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        كل التذاكر
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted" dir="ltr">
            {ticket.ticketNo}
          </p>
          <h1 className="text-xl font-bold">
            {departmentLabel(ticket.department ?? "general")}
          </h1>
        </div>
        <div className="flex gap-2">
          <Badge tone={pr.tone}>{pr.label}</Badge>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-5">
              <TicketThread
                ticketId={ticket.id}
                viewerIsStaff
                closed={ticket.status === "closed"}
                messages={messages.map((m) => ({
                  id: m.id,
                  sender: m.sender,
                  body: m.body,
                  createdAt: formatDate(m.createdAt),
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">العميل</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {customer && (
                <Link
                  href={`/admin/users/${customer.id}`}
                  className="font-semibold text-gold hover:underline"
                >
                  {customer.name}
                </Link>
              )}
              <p className="mt-1 text-xs text-muted" dir="ltr">
                {customer?.email}
              </p>
              {ticket.relatedOrderId && (
                <Link
                  href={`/admin/orders/${ticket.relatedOrderId}`}
                  className="mt-3 block text-sm text-gold hover:underline"
                >
                  الطلب المرتبط ↗
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">إدارة التذكرة</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketStatusControl ticketId={ticket.id} status={ticket.status} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
