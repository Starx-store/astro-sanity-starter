"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

const TIERS = [
  { id: "standard", label: "⚪ عضوية عادية (Standard)", desc: "أسعار الشراء العادية للمستهلك" },
  { id: "silver", label: "🥈 الباقة الفضية (Silver)", desc: "خصومات وخيارات تجار فضية" },
  { id: "gold", label: "🥇 الباقة الذهبية (Gold Trader)", desc: "أسعار باقة التاجر المخصصة للمنتجات" },
  { id: "platinum", label: "💎 الباقة الماسية VIP (Platinum)", desc: "أعلى أولوية وأفضل أسعار جملة للموزعين" },
] as const;

/** تفعيل/تغيير باقة العضوية ورتبة الحساب (عادي، فضي، ذهبي، ماسي) */
export function TraderToggle({
  userId,
  isTrader,
  membershipTier = "standard",
}: {
  userId: string;
  isTrader: boolean;
  membershipTier?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>(
    membershipTier || (isTrader ? "gold" : "standard")
  );

  async function updateTier(newTier: string) {
    setLoading(true);
    setError(null);
    const res = await apiPost<{ isTrader: boolean; membershipTier: string }>(
      `/api/admin/users/${userId}/trader`,
      { membershipTier: newTier, isTrader: newTier !== "standard" }
    );
    setLoading(false);
    if (res.ok) {
      setCurrentTier(newTier);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted">اختر باقة العضوية للمستخدم:</label>
        <div className="grid gap-2">
          {TIERS.map((t) => {
            const active = currentTier === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={loading}
                onClick={() => updateTier(t.id)}
                className={`flex items-center justify-between rounded-xl border p-3 text-right text-xs transition-all ${
                  active
                    ? "border-gold bg-gold/10 text-foreground font-bold shadow-sm"
                    : "border-border/60 bg-surface-2/40 text-muted hover:border-gold/40 hover:text-foreground"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Award className={`h-4 w-4 ${active ? "text-gold" : "text-muted"}`} />
                    {t.label}
                  </div>
                  <p className="mt-0.5 text-[11px] font-normal text-muted">{t.desc}</p>
                </div>
                {active && <Check className="h-4 w-4 text-gold shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
