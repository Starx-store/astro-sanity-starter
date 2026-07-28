"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ExternalLink, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    expired: (s: string) =>
      `انتهت صلاحية أمر الدفع (${s}). أنشئ طلبًا جديدًا.`,
    notYet: (s: string) =>
      `لم يصل الدفع بعد — حالة Binance: ${s}. أكمل الدفع ثم حدّث.`,
    doneMsg: "تم الدفع بنجاح وأُضيف الرصيد إلى محفظتك. ⚡",
    another: "شحن مبلغ آخر",
    completeHint:
      "أكمل الدفع في صفحة Binance ثم اضغط «تحديث الحالة» — الرصيد يُضاف تلقائيًا فور التأكيد.",
    qrAlt: "امسح للدفع عبر تطبيق Binance",
    openPay: "فتح صفحة الدفع",
    refresh: "تحديث الحالة",
    cancelNew: "إلغاء وبدء طلب جديد",
    amountLabel: "المبلغ (USDT)",
    amountHint: (min: string) =>
      `الحد الأدنى ${min}$ — يُضاف الرصيد تلقائيًا فور الدفع.`,
    payBtn: "ادفع عبر Binance Pay",
  },
  en: {
    expired: (s: string) =>
      `The payment order expired (${s}). Create a new request.`,
    notYet: (s: string) =>
      `Payment not received yet — Binance status: ${s}. Complete the payment, then refresh.`,
    doneMsg: "Payment successful — funds added to your wallet. ⚡",
    another: "Top up another amount",
    completeHint:
      "Complete the payment on the Binance page, then tap \"Refresh status\" — funds are credited automatically once confirmed.",
    qrAlt: "Scan to pay with the Binance app",
    openPay: "Open payment page",
    refresh: "Refresh status",
    cancelNew: "Cancel and start a new request",
    amountLabel: "Amount (USDT)",
    amountHint: (min: string) =>
      `Minimum ${min}$ — funds are credited automatically once paid.`,
    payBtn: "Pay with Binance Pay",
  },
} as const;

type PayInfo = {
  checkoutUrl: string | null;
  universalUrl: string | null;
  qrcodeLink: string | null;
  expireTime: number | null;
};

/** شحن تلقائي عبر Binance Pay: مبلغ → رابط دفع + QR → تحديث الحالة. */
export function BinanceDeposit({ minDeposit }: { minDeposit: string }) {
  const t = T[useLocale()];
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "created" | "done">("idle");
  const [amount, setAmount] = useState("");
  const [depositId, setDepositId] = useState<string | null>(null);
  const [pay, setPay] = useState<PayInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldError(undefined);
    setStatusMsg(null);

    const res = await apiPost<{ deposit: { id: string }; pay: PayInfo }>(
      "/api/wallet/deposits/binance",
      { amount },
    );
    setLoading(false);

    if (res.ok) {
      setDepositId(res.data.deposit.id);
      setPay(res.data.pay);
      setPhase("created");
      router.refresh();
    } else {
      setFieldError(res.fieldErrors?.amount);
      setError(res.error);
    }
  }

  async function check() {
    if (!depositId) return;
    setChecking(true);
    setError(null);
    setStatusMsg(null);

    const res = await apiPost<{ status: string; externalStatus: string }>(
      `/api/wallet/deposits/binance/${depositId}/check`,
      {},
    );
    setChecking(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data.status === "completed") {
      setPhase("done");
      router.refresh();
    } else if (res.data.status === "expired") {
      setError(t.expired(res.data.externalStatus));
      setPhase("idle");
      setPay(null);
      setDepositId(null);
    } else {
      setStatusMsg(t.notYet(res.data.externalStatus));
    }
  }

  function reset() {
    setPhase("idle");
    setPay(null);
    setDepositId(null);
    setAmount("");
    setError(null);
    setStatusMsg(null);
  }

  if (phase === "done") {
    return (
      <div className="space-y-3">
        <Alert tone="success">{t.doneMsg}</Alert>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          {t.another}
        </Button>
      </div>
    );
  }

  if (phase === "created" && pay) {
    const payUrl = pay.checkoutUrl ?? pay.universalUrl;
    return (
      <div className="space-y-4">
        <Alert tone="info">{t.completeHint}</Alert>

        {pay.qrcodeLink && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pay.qrcodeLink}
            alt={t.qrAlt}
            className="mx-auto h-40 w-40 rounded-lg bg-white p-2"
          />
        )}

        <div className="grid gap-2">
          {payUrl && (
            <a href={payUrl} target="_blank" rel="noreferrer">
              <Button className="w-full">
                <ExternalLink className="h-4 w-4" />
                {t.openPay}
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            className="w-full"
            loading={checking}
            onClick={check}
          >
            <RefreshCw className="h-4 w-4" />
            {t.refresh}
          </Button>
        </div>

        {statusMsg && <Alert tone="warning">{statusMsg}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <button
          type="button"
          onClick={reset}
          className="text-xs text-muted underline hover:text-foreground"
        >
          {t.cancelNew}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={create} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field
        label={t.amountLabel}
        htmlFor="bp-amount"
        error={fieldError}
        hint={t.amountHint(minDeposit)}
      >
        <Input
          id="bp-amount"
          inputMode="decimal"
          dir="ltr"
          placeholder="10.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          invalid={!!fieldError}
          required
        />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        <Zap className="h-4 w-4" />
        {t.payBtn}
      </Button>
    </form>
  );
}
