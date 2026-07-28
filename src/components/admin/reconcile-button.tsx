"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

type Mismatch = {
  walletId: string;
  userId: string;
  storedBalance: string;
  computedBalance: string;
  storedHeld: string;
  computedHeld: string;
};

export function ReconcileButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ checked: number; mismatches: Mismatch[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await apiPost<{ checked: number; mismatches: Mismatch[] }>(
      "/api/admin/reconcile",
      {},
    );
    setLoading(false);
    if (res.ok) setResult(res.data);
    else setError(res.error);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        يعيد بناء أرصدة كل المحافظ من سجل القيود ويكشف أي انحراف.
      </p>
      <Button variant="outline" onClick={run} loading={loading}>
        <ScanLine className="h-4 w-4" />
        تشغيل المطابقة
      </Button>

      {error && <Alert tone="danger">{error}</Alert>}
      {result &&
        (result.mismatches.length === 0 ? (
          <Alert tone="success">
            تم فحص {result.checked} محفظة — كل الأرصدة مطابقة للقيود. ✓
          </Alert>
        ) : (
          <Alert tone="danger">
            انحراف في {result.mismatches.length} من {result.checked} محفظة:
            <ul className="mt-2 space-y-1 text-xs" dir="ltr">
              {result.mismatches.slice(0, 10).map((m) => (
                <li key={m.walletId}>
                  {m.userId.slice(0, 8)}… balance {m.storedBalance}≠{m.computedBalance}, held{" "}
                  {m.storedHeld}≠{m.computedHeld}
                </li>
              ))}
            </ul>
          </Alert>
        ))}
    </div>
  );
}
