"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, RotateCcw, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

/** أزرار مزامنة/إعادة إرسال الطلبات التلقائية في لوحة الأدمن. */
export function OrderSyncButtons({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"sync" | "retry" | "refill" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: "sync" | "retry" | "refill") {
    setLoading(action);
    setError(null);
    setNotice(null);
    const res = await apiPost(`/api/admin/orders/${orderId}/sync`, { action });
    setLoading(null);
    if (res.ok) {
      if (action === "refill") setNotice("أُرسل طلب إعادة التعبئة للمزوّد.");
      router.refresh();
    } else setError(res.error);
  }

  const canSync = ["sent_to_provider", "in_progress"].includes(status);
  // under_review لطلب تلقائي = حُجز المبلغ وتعطّل الإرسال قبل بلوغ المزوّد
  const canRetry = ["needs_manual", "under_review"].includes(status);
  // إعادة التعبئة تُطلب بعد اكتمال الطلب (أو تنفيذه جزئيًا) عند نقص العدد.
  const canRefill = ["completed", "in_progress", "needs_manual"].includes(
    status,
  );

  return (
    <div className="space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      {canSync && (
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start"
          loading={loading === "sync"}
          onClick={() => run("sync")}
        >
          <RefreshCw className="h-4 w-4" />
          مزامنة الحالة من المزوّد
        </Button>
      )}
      {canRetry && (
        <Button
          size="sm"
          variant="subtle"
          className="w-full justify-start"
          loading={loading === "retry"}
          onClick={() => run("retry")}
        >
          <RotateCcw className="h-4 w-4" />
          إعادة الإرسال للمزوّد
        </Button>
      )}
      {canRefill && (
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start"
          loading={loading === "refill"}
          onClick={() => run("refill")}
        >
          <PackagePlus className="h-4 w-4" />
          طلب إعادة تعبئة (Refill)
        </Button>
      )}
    </div>
  );
}
