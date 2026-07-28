"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";

/** أزرار اعتماد/رفض طلب شحن في لوحة الأدمن. */
export function DepositReview({ depositId }: { depositId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "approve" | "reject") {
    setLoading(action);
    setError(null);
    const res = await apiPost(`/api/admin/deposits/${depositId}/review`, {
      action,
      reason: action === "reject" ? reason : undefined,
    });
    setLoading(null);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.fieldErrors?.reason ?? res.error);
    }
  }

  if (rejecting) {
    return (
      <div className="flex w-full flex-col gap-2">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب الرفض (يظهر للعميل)"
          rows={2}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="danger"
            loading={loading === "reject"}
            onClick={() => submit("reject")}
          >
            تأكيد الرفض
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={loading !== null}
            onClick={() => {
              setRejecting(false);
              setError(null);
            }}
          >
            إلغاء
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={loading === "approve"}
          onClick={() => submit("approve")}
        >
          <Check className="h-4 w-4" />
          اعتماد
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={() => setRejecting(true)}
        >
          <X className="h-4 w-4" />
          رفض
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
