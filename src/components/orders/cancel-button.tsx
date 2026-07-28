"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

/** إلغاء الطلب من العميل (قبل بدء التنفيذ) — بخطوة تأكيد. */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);
    const res = await apiPost(`/api/orders/${orderId}/cancel`, {});
    setLoading(false);
    if (res.ok) {
      setConfirming(false);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        {error && <Alert tone="danger">{error}</Alert>}
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          إلغاء الطلب واسترجاع المبلغ
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-danger/30 bg-danger/5 p-4">
      <p className="text-sm">سيُلغى الطلب ويعود المبلغ لرصيدك المتاح فورًا. متأكد؟</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <Button variant="danger" size="sm" loading={loading} onClick={cancel}>
          نعم، ألغِ الطلب
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setConfirming(false)}
        >
          تراجع
        </Button>
      </div>
    </div>
  );
}
