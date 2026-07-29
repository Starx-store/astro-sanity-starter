"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Award, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

const TIERS = [
  { id: "standard", label: "⚪ عادي (Standard)", desc: "مستخدم عادي — الشراء بالأسعار الافتراضية" },
  { id: "silver", label: "🥈 فضي (Silver)", desc: "مستوى فضي — خصم تلقائي 3% على الطلبات" },
  { id: "gold", label: "🥇 ذهبي (Gold)", desc: "مستوى ذهبي — خصم تلقائي 5% على الطلبات" },
  { id: "trader", label: "🏪 تاجر (Trader)", desc: "حساب تاجر — تفعيل أسعار التاجر المحددة للمنتجات" },
] as const;

/** تفعيل/تغيير باقة التاجر والعضوية لعميل (عادي، فضي، ذهبي، تاجر) */
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
    membershipTier === "trader" || (isTrader && membershipTier === "standard")
      ? "trader"
      : membershipTier || "standard"
  );

  async function toggleTraderDirect() {
    const nextIsTrader = !isTrader;
    const nextTier = nextIsTrader ? "trader" : "standard";
    await updateTier(nextTier, nextIsTrader);
  }

  async function updateTier(newTier: string, forceIsTrader?: boolean) {
    setLoading(true);
    setError(null);
    const traderFlag = typeof forceIsTrader === "boolean" ? forceIsTrader : newTier === "trader";
    const res = await apiPost<{ isTrader: boolean; membershipTier: string }>(
      `/api/admin/users/${userId}/trader`,
      { membershipTier: newTier, isTrader: traderFlag }
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
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      
      {/* 1) Direct Trader Toggle Button */}
      <Button
        variant={isTrader || currentTier === "trader" ? "outline" : "subtle"}
        size="md"
        className="w-full justify-center font-bold"
        loading={loading}
        onClick={toggleTraderDirect}
      >
        <Store className="h-4 w-4" />
        {isTrader || currentTier === "trader" ? "إلغاء حساب التاجر (إعادة لعادي)" : "⚡ تفعيل حساب تاجر فوراً"}
      </Button>

      <hr className="border-border/60" />

      {/* 2) Tier Selection */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-foreground">تحديد رتبة العضوية للمستخدم:</label>
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
