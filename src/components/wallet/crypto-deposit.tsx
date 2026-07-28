"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Copy, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    credited: (amt: string) => `تم شحن ${amt}$ في محفظتك.`,
    again: "شحن مرة أخرى",
    amountLabel: "المبلغ بالدولار",
    amountHint: (min: string) => `الحد الأدنى ${min}$`,
    createBtn: "إنشاء طلب شحن",
    networkNote:
      "تحويل USDT / USDC / BUSD على شبكة BEP20 — يُشحن رصيدك تلقائيًا بعد تأكيد الشبكة.",
    exactPrefix: "حوّل هذا المبلغ ",
    exactHighlight: "بالضبط",
    exactSuffix: ":",
    copyAmount: "نسخ المبلغ",
    toAddress: (network: string) => `إلى هذا العنوان (${network}):`,
    copyAddress: "نسخ العنوان",
    uniqueNote: (amt: string) =>
      `أضفنا كسورًا صغيرة جدًا إلى مبلغك (${amt}$) كي نتعرّف على تحويلك تلقائيًا — الفرق أقل من خمسة سنتات ويُضاف كاملًا إلى رصيدك.`,
    warnPrefix: "⚠️ حوّل المبلغ ",
    warnExact: "بالضبط",
    warnMiddle: " كما هو أعلاه، وتأكد أن الشبكة ",
    warnNetwork: "BEP20 (BSC)",
    warnSuffix: ".",
    txLabel: "رقم المعاملة (Transaction Hash)",
    txHint: (n: number) => `بعد ${n} تأكيدات على الشبكة`,
    verifyBtn: "تحقّق واشحن رصيدي",
    cancel: "إلغاء",
  },
  en: {
    credited: (amt: string) => `${amt}$ has been added to your wallet.`,
    again: "Top up again",
    amountLabel: "Amount in USD",
    amountHint: (min: string) => `Minimum ${min}$`,
    createBtn: "Create deposit request",
    networkNote:
      "Send USDT / USDC / BUSD on the BEP20 network — your balance is credited automatically after network confirmation.",
    exactPrefix: "Send this ",
    exactHighlight: "exact",
    exactSuffix: " amount:",
    copyAmount: "Copy amount",
    toAddress: (network: string) => `To this address (${network}):`,
    copyAddress: "Copy address",
    uniqueNote: (amt: string) =>
      `We added a tiny fraction to your amount (${amt}$) so we can detect your transfer automatically — the difference is under five cents and is fully credited to your balance.`,
    warnPrefix: "⚠️ Send the ",
    warnExact: "exact",
    warnMiddle: " amount shown above, and make sure the network is ",
    warnNetwork: "BEP20 (BSC)",
    warnSuffix: ".",
    txLabel: "Transaction hash",
    txHint: (n: number) => `After ${n} network confirmations`,
    verifyBtn: "Verify and credit my balance",
    cancel: "Cancel",
  },
} as const;

interface Created {
  depositId: string;
  address: string;
  network: string;
  minConfirmations: number;
  exactAmount: string;
  requestedAmount: string;
}

/**
 * شحن بعملة رقمية على BEP20: ننشئ طلبًا بمبلغ فريد، يحوّله العميل بالضبط،
 * ثم يلصق رقم المعاملة فيتحقق الخادم من البلوكتشين ويشحن تلقائيًا.
 */
export function CryptoDeposit({
  minDeposit,
  currency,
}: {
  minDeposit: string;
  currency?: { label: string; rate: number } | null;
}) {
  const t = T[useLocale()];
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<"addr" | "amt" | null>(null);

  // معاينة بعملة العميل (تقديرية) لمساعدته على تقدير المبلغ.
  const localHint = (() => {
    const n = Number(amount);
    if (!currency || !Number.isFinite(n) || n <= 0) return null;
    const v = n * currency.rate;
    return `≈ ${v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : 2 })} ${currency.label}`;
  })();

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiPost<Created>("/api/wallet/deposits/crypto", { amount });
    setLoading(false);
    if (res.ok) setCreated(res.data);
    else
      setError(
        res.fieldErrors ? Object.values(res.fieldErrors).join(" · ") : res.error,
      );
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!created) return;
    setVerifying(true);
    setError(null);
    const res = await apiPost<{ credited: boolean; amount: string }>(
      `/api/wallet/deposits/crypto/${created.depositId}/verify`,
      { txHash },
    );
    setVerifying(false);
    if (res.ok) {
      setSuccess(t.credited(res.data.amount));
      setCreated(null);
      setTxHash("");
      setAmount("");
      router.refresh();
    } else {
      setError(
        res.fieldErrors ? Object.values(res.fieldErrors).join(" · ") : res.error,
      );
    }
  }

  function copy(text: string, what: "addr" | "amt") {
    navigator.clipboard?.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  if (success) {
    return (
      <div className="space-y-3">
        <Alert tone="success">{success}</Alert>
        <Button variant="outline" onClick={() => setSuccess(null)}>
          {t.again}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      {!created ? (
        <form onSubmit={start} className="space-y-4">
          <Field
            label={t.amountLabel}
            hint={localHint ?? t.amountHint(minDeposit)}
          >
            <Input
              dir="ltr"
              inputMode="decimal"
              placeholder="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            <Coins className="h-4 w-4" />
            {t.createBtn}
          </Button>
          <p className="text-xs text-muted">{t.networkNote}</p>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-gold/40 bg-gold/5 p-4">
            <p className="mb-3 text-sm font-medium">
              {t.exactPrefix}
              <span className="text-gold">{t.exactHighlight}</span>
              {t.exactSuffix}
            </p>
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-surface-2 p-3">
              <span className="font-mono text-lg font-bold" dir="ltr">
                {created.exactAmount}
              </span>
              <button
                type="button"
                onClick={() => copy(created.exactAmount, "amt")}
                className="text-muted hover:text-foreground"
                aria-label={t.copyAmount}
              >
                {copied === "amt" ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <p className="mb-2 text-sm font-medium">
              {t.toAddress(created.network)}
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 p-3">
              <span className="break-all font-mono text-xs" dir="ltr">
                {created.address}
              </span>
              <button
                type="button"
                onClick={() => copy(created.address, "addr")}
                className="shrink-0 text-muted hover:text-foreground"
                aria-label={t.copyAddress}
              >
                {copied === "addr" ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <p className="mt-3 text-xs text-muted">
              {t.uniqueNote(created.requestedAmount)}
            </p>
            <p className="mt-2 text-xs text-warning">
              {t.warnPrefix}
              <b>{t.warnExact}</b>
              {t.warnMiddle}
              <b>{t.warnNetwork}</b>
              {t.warnSuffix}
            </p>
          </div>

          <form onSubmit={verify} className="space-y-3">
            <Field
              label={t.txLabel}
              hint={t.txHint(created.minConfirmations)}
            >
              <Input
                dir="ltr"
                placeholder="0x..."
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" loading={verifying}>
              <ShieldCheck className="h-4 w-4" />
              {t.verifyBtn}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setCreated(null);
                setError(null);
              }}
            >
              {t.cancel}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
