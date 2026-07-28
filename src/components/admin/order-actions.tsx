"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, MessageCircleQuestion, CheckCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

type Action = "in_progress" | "needs_info" | "completed" | "refunded";

/** لوحة إجراءات الأدمن على الطلب حسب الحالة الحالية. */
export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed: Action[] =
    status === "under_review"
      ? ["in_progress", "needs_info", "completed", "refunded"]
      : status === "needs_info"
        ? ["in_progress", "refunded"]
        : status === "in_progress"
          ? ["completed", "needs_info", "refunded"]
          : status === "needs_manual"
            ? ["completed", "refunded"]
            : status === "sent_to_provider"
              ? ["completed", "refunded"]
              : [];

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-muted">
        الطلب في حالة نهائية — لا إجراءات متاحة.
      </p>
    );
  }

  async function submit(to: Action) {
    setLoading(true);
    setError(null);
    const res = await apiPost(`/api/admin/orders/${orderId}/status`, {
      to,
      note: note || undefined,
      deliveryText: to === "completed" ? deliveryText || undefined : undefined,
    });
    setLoading(false);
    if (res.ok) {
      setActive(null);
      setNote("");
      setDeliveryText("");
      router.refresh();
    } else {
      setError(res.fieldErrors?.note ?? res.fieldErrors?.deliveryText ?? res.error);
    }
  }

  const configs: Record<
    Action,
    {
      label: string;
      Icon: typeof Play;
      variant: "primary" | "outline" | "danger" | "subtle";
      needsNote: boolean;
      noteLabel?: string;
      needsDelivery?: boolean;
      confirmLabel: string;
    }
  > = {
    in_progress: {
      label: "بدء التنفيذ",
      Icon: Play,
      variant: "primary",
      needsNote: false,
      confirmLabel: "تأكيد بدء التنفيذ",
    },
    needs_info: {
      label: "طلب معلومات",
      Icon: MessageCircleQuestion,
      variant: "subtle",
      needsNote: true,
      noteLabel: "ما المعلومات المطلوبة من العميل؟ (تصل كرسالة)",
      confirmLabel: "إرسال الطلب للعميل",
    },
    completed: {
      label: "إكمال وتسليم",
      Icon: CheckCheck,
      variant: "primary",
      needsNote: false,
      needsDelivery: true,
      confirmLabel: "تأكيد الإكمال (خصم نهائي)",
    },
    refunded: {
      label: "استرجاع المبلغ",
      Icon: Undo2,
      variant: "danger",
      needsNote: true,
      noteLabel: "سبب الاسترجاع (يظهر للعميل)",
      confirmLabel: "تأكيد الاسترجاع",
    },
  };

  if (active) {
    const cfg = configs[active];
    return (
      <div className="space-y-3 rounded-lg border border-border bg-surface-2/40 p-4">
        <p className="text-sm font-semibold">{cfg.label}</p>

        {cfg.needsDelivery && (
          <div>
            <p className="mb-1 text-xs text-muted">
              بيانات التسليم (كود/حساب/تفاصيل — تظهر للعميل)
            </p>
            <textarea
              value={deliveryText}
              onChange={(e) => setDeliveryText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {cfg.needsNote && (
          <div>
            <p className="mb-1 text-xs text-muted">{cfg.noteLabel}</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {!cfg.needsNote && !cfg.needsDelivery && (
          <p className="text-xs text-muted">
            ملاحظة اختيارية للسجل:
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block h-9 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </p>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={cfg.variant}
            loading={loading}
            onClick={() => submit(active)}
          >
            {cfg.confirmLabel}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={loading}
            onClick={() => {
              setActive(null);
              setError(null);
            }}
          >
            تراجع
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-2">
        {allowed.map((a) => {
          const cfg = configs[a];
          return (
            <Button
              key={a}
              size="sm"
              variant={cfg.variant}
              onClick={() => setActive(a)}
              className="justify-start"
            >
              <cfg.Icon className="h-4 w-4" />
              {cfg.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
