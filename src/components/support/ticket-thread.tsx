"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    support: "الدعم",
    customer: "العميل",
    closedNote: "التذكرة مغلقة — افتح تذكرة جديدة إن احتجت.",
    placeholder: "اكتب ردّك...",
    send: "إرسال",
  },
  en: {
    support: "Support",
    customer: "Customer",
    closedNote: "This ticket is closed — open a new one if you need more help.",
    placeholder: "Write your reply...",
    send: "Send",
  },
} as const;

export type ThreadMessage = {
  id: string;
  sender: "customer" | "staff";
  body: string;
  createdAt: string;
};

export function TicketThread({
  ticketId,
  messages,
  viewerIsStaff,
  closed,
}: {
  ticketId: string;
  messages: ThreadMessage[];
  viewerIsStaff: boolean;
  closed: boolean;
}) {
  const router = useRouter();
  const t = T[useLocale()];
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    setError(null);
    const res = await apiPost(`/api/support/${ticketId}/messages`, { body });
    setLoading(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else {
      setError(res.fieldErrors?.body ?? res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {messages.map((m) => {
          const mine = viewerIsStaff ? m.sender === "staff" : m.sender === "customer";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-line rounded-lg px-4 py-2.5 text-sm",
                  mine ? "bg-gold/15" : "bg-surface-2",
                )}
              >
                <p className="mb-1 text-[11px] font-semibold text-muted">
                  {m.sender === "staff" ? t.support : t.customer} ·{" "}
                  <span dir="ltr">{m.createdAt}</span>
                </p>
                <p className="leading-relaxed">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {closed ? (
        <Alert tone="info">{t.closedNote}</Alert>
      ) : (
        <form onSubmit={send} className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t.placeholder}
            rows={2}
            className="flex-1 rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" loading={loading} disabled={!body.trim()}>
            <Send className="h-4 w-4" />
            {t.send}
          </Button>
        </form>
      )}
    </div>
  );
}
