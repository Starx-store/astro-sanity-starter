import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getTicketForUser } from "@/server/support/service";
import { formatDate, isUuid } from "@/lib/utils";
import { ticketStatusLabel, departmentLabel } from "@/lib/labels";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TicketThread } from "@/components/support/ticket-thread";
import { getLocale } from "@/server/locale";

export const dynamic = "force-dynamic";

const T = {
  ar: { allTickets: "كل التذاكر" },
  en: { allTickets: "All tickets" },
} as const;

export default async function TicketPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const user = await requireUser();
  if (!isUuid(params.id)) notFound();

  const data = await getTicketForUser(params.id, user.id);
  if (!data) notFound();
  const { ticket, messages } = data;
  const locale = await getLocale();
  const st = ticketStatusLabel(ticket.status, locale);
  const t = T[locale];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <Link
          href="/support"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          {t.allTickets}
        </Link>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted" dir="ltr">
              {ticket.ticketNo}
            </p>
            <h1 className="text-xl font-bold">
              {departmentLabel(ticket.department ?? "general", locale)}
            </h1>
            <p className="text-xs text-muted">{formatDate(ticket.createdAt)}</p>
          </div>
          <Badge tone={st.tone} className="px-3 py-1 text-sm">
            {st.label}
          </Badge>
        </div>

        <Card>
          <CardContent className="p-5">
            <TicketThread
              ticketId={ticket.id}
              viewerIsStaff={false}
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
      </main>
    </div>
  );
}
