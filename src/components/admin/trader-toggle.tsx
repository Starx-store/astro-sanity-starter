"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Award, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

const TIERS = [
  { id: "standard", label: "⚪ باقة عادية (Standard)", desc: "سعر العملاء الاعتيادي بدون خصومات رتبة" },
  { id: "silver", label: "🥈 باقة فضية (Silver)", desc: "خصم رتبة إضافي 3% تلقائي على الطلبات" },
  { id: "gold", label: "🥇 باقة ذهبية (Gold)", desc: "خصم رتبة إضافي 5% تلقائي على الطلبات" },
  { id: "platinum", label: "💎 باقة ماسية VIP (Platinum)", desc: "خصم رتبة إضافي 10% تلقائي للموزعين VIP" },
] as const;

/** تفعيل/تغيير باقة التاجر والعضوية لعميل بشكل مستقل */
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
  const [traderState, setTraderState] = useState<boolean>(isTrader);
  const [currentTier, setCurrentTier] = useState<string>(membershipTier || "standard");

  async function toggleTraderDirect() {
    setLoading(true);
    setError(null);
    const nextState = !traderState;
    const res = await apiPost<{ isTrader: boolean }>(`/api/admin/users/${userId}/trader`, {
      isTrader: nextState,
    });
    setLoading(false);
    if (res.ok) {
      setTraderState(nextState);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  async function updateTier(newTier: string) {
    setLoading(true);
    setError(null);
    const res = await apiPost<{ membershipTier: string }>(`/api/admin/users/${userId}/trader`, {
      membershipTier: newTier,
    });
    setLoading(false);
    if (res.ok) {
      setCurrentTier(newTier);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}

      {/* 1) Trader Account Status Toggle */}
      <div className="rounded-xl border border-border/80 bg-surface-2/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Store className="h-4 w-4 text-gold" />
              حالة حساب التاجر (Trader Account):
            </h4>
            <p className="text-[11px] text-muted mt-0.5">
              تفعيل الأسعار الخاصة المحددة للتجار في صفحة المنتجات.
            </p>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
            traderState ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-surface text-muted"
          }`}>
            {traderState ? "🏆 حساب تاجر مُفعّل" : "⚪ حساب عادي"}
          </span>
        </div>

        <Button
          variant={traderState ? "outline" : "subtle"}
          size="sm"
          className="w-full justify-center font-bold mt-2"
          loading={loading}
          onClick={toggleTraderDirect}
        >
          {traderState ? "إلغاء صفة التاجر" : "⚡ تفعيل حساب تاجر فوراً"}
        </Button>
      </div>

      {/* 2) Independent Membership Tier Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Award className="h-4 w-4 text-gold" />
          رتبة وباقة العضوية المستقلة (Membership Tier):
        </label>
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
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
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
