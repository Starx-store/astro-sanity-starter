"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";

/** مزامنة يدوية لأسعار منتجات المزوّد مع أسعاره الحالية. */
export function SyncPricesButton({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    const res = await apiPost<{ checked: number; updated: number }>(
      `/api/admin/providers/${providerId}/sync-prices`,
      {},
    );
    setLoading(false);
    if (res.ok) {
      setResult(
        res.data.updated > 0
          ? `حُدّث سعر ${res.data.updated} منتج`
          : `لا تغيّر (${res.data.checked} منتجًا)`,
      );
      router.refresh();
    } else {
      setResult(res.error);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-muted">{result}</span>}
      <Button type="button" size="sm" variant="outline" loading={loading} onClick={run}>
        <RefreshCcw className="h-4 w-4" />
        مزامنة الأسعار
      </Button>
    </div>
  );
}
