"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * حذف منتج — بتأكيد داخلي. المنتجات التي لها طلبات لا تُحذف (يمنعها الخادم)
 * ويُقترح إخفاؤها بدل الحذف حفاظًا على سجل الطلبات.
 */
export function ProductDeleteButton({
  productId,
  productName,
  compact = false,
}: {
  productId: string;
  productName: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function remove() {
    setLoading(true);
    setError(null);
    const r = await fetch(`/api/admin/products/${productId}`, {
      method: "DELETE",
    });
    const j = await r.json().catch(() => null);
    setLoading(false);
    if (r.ok && j?.ok) {
      setConfirming(false);
      if (j.data?.archived) {
        setNotice(
          "للمنتج طلبات سابقة، فأُرشِف بدل الحذف: أُخفي من المتجر وفُكّ ربطه بالمزوّد وأُزيل مخزونه.",
        );
      }
      router.refresh();
    } else {
      setError(j?.error ?? "تعذّر الحذف.");
    }
  }

  if (notice) {
    return <p className="max-w-[280px] text-xs text-muted">{notice}</p>;
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-xs text-danger">
          حذف «{productName}»؟ إن كانت له طلبات سابقة سيُؤرشَف (يُخفى) بدل
          الحذف حفاظًا على سجل الطلبات.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="danger" loading={loading} onClick={remove}>
            نعم، احذف
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
          >
            إلغاء
          </Button>
        </div>
        {error && <p className="max-w-[240px] text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return compact ? (
    <button
      type="button"
      aria-label={`حذف ${productName}`}
      className="text-danger/70 transition-colors hover:text-danger"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ) : (
    <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
      <Trash2 className="h-4 w-4 text-danger" />
      حذف المنتج
    </Button>
  );
}
