"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type OrderMessageItem = {
  id: string;
  sender: "customer" | "staff";
  body: string;
  createdAt: string;
};

/** سلسلة رسائل الطلب + مربع إرسال — تُستخدم في صفحة العميل والأدمن. */
export function OrderMessages({
  orderId,
  messages,
  viewerIsStaff,
  disabled,
}: {
  orderId: string;
  messages: OrderMessageItem[];
  viewerIsStaff: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    setError(null);
    const res = await apiPost(`/api/orders/${orderId}/messages`, { body });
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
      {messages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          لا توجد رسائل بعد — يمكنك مراسلة {viewerIsStaff ? "العميل" : "الفريق"} هنا.
        </p>
      ) : (
        <div className="max-h-96 space-y-3 overflow-y-auto pl-1">
          {messages.map((m) => {
            const mine = viewerIsStaff ? m.sender === "staff" : m.sender === "customer";
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-start" : "justify-end")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-2.5 text-sm",
                    mine
                      ? "bg-gold/15 text-foreground"
                      : "bg-surface-2 text-foreground",
                  )}
                >
                  <p className="mb-1 text-[11px] font-semibold text-muted">
                    {m.sender === "staff" ? "الفريق" : "العميل"} ·{" "}
                    <span dir="ltr">{m.createdAt}</span>
                  </p>
                  <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {!disabled && (
        <form onSubmit={send} className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب رسالتك..."
            rows={2}
            className="flex-1 rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" loading={loading} disabled={!body.trim()}>
            <Send className="h-4 w-4" />
            إرسال
          </Button>
        </form>
      )}
    </div>
  );
}
