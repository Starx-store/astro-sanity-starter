"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

export function ProviderTestButton({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    balance?: string | null;
  } | null>(null);

  async function test() {
    setLoading(true);
    setResult(null);
    const res = await apiPost<{ ok: boolean; message: string; balance?: string | null }>(
      `/api/admin/providers/${providerId}/test`,
      {},
    );
    setLoading(false);
    if (res.ok) {
      setResult(res.data);
      router.refresh();
    } else {
      setResult({ ok: false, message: res.error });
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={test} loading={loading}>
        <PlugZap className="h-4 w-4" />
        اختبار الاتصال
      </Button>
      {result && (
        <Alert tone={result.ok ? "success" : "danger"}>
          {result.message}
          {result.ok && result.balance != null && (
            <span className="mt-1 block">
              رصيد المزوّد: <span dir="ltr">{result.balance}</span>
            </span>
          )}
        </Alert>
      )}
    </div>
  );
}
