"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

/** تفعيل/إلغاء باقة التاجر — تمنح المستخدم الأسعار الخاصة بالتجار. */
export function TraderToggle({
  userId,
  isTrader,
}: {
  userId: string;
  isTrader: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setError(null);
    const res = await apiPost(`/api/admin/users/${userId}/trader`, {
      isTrader: !isTrader,
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <div className="space-y-2">
      {error && <Alert tone="danger">{error}</Alert>}
      <Button
        variant={isTrader ? "outline" : "subtle"}
        size="sm"
        className="w-full justify-start"
        loading={loading}
        onClick={toggle}
      >
        <Store className="h-4 w-4" />
        {isTrader ? "إلغاء باقة التاجر" : "تفعيل باقة التاجر"}
      </Button>
      <p className="text-xs text-muted">
        التاجر يشتري بالأسعار الخاصة المحددة داخل كل منتج (إن وُجدت).
      </p>
    </div>
  );
}
