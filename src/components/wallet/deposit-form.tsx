"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPostForm } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    received: "تم استلام طلب الشحن وسيُراجع من الإدارة قريبًا.",
    amountLabel: "المبلغ (USD)",
    amountHint: (min: string) => `الحد الأدنى للشحن ${min}$.`,
    proofLabel: "إثبات التحويل",
    proofHint: "صورة أو PDF حتى 4MB.",
    submit: "إرسال طلب الشحن",
  },
  en: {
    received: "Your deposit request was received and will be reviewed shortly.",
    amountLabel: "Amount (USD)",
    amountHint: (min: string) => `Minimum deposit ${min}$.`,
    proofLabel: "Transfer proof",
    proofHint: "Image or PDF up to 4MB.",
    submit: "Submit deposit request",
  },
} as const;

/** نموذج طلب شحن يدوي: مبلغ + إثبات تحويل. */
export function DepositForm({
  minDeposit,
  currency,
}: {
  minDeposit: string;
  /** عملة العرض — لتقدير المبلغ بعملة العميل أثناء الكتابة. */
  currency?: { label: string; rate: number } | null;
}) {
  const t = T[useLocale()];
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [amount, setAmount] = useState("");

  // تقدير بعملة العميل — الشحن الفعلي يبقى بالدولار.
  const localHint = (() => {
    const n = Number(amount);
    if (!currency || !Number.isFinite(n) || n <= 0) return null;
    const v = n * currency.rate;
    return `≈ ${v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : 2 })} ${currency.label}`;
  })();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const res = await apiPostForm("/api/wallet/deposits", form);
    setLoading(false);

    if (res.ok) {
      setSuccess(true);
      formRef.current?.reset();
      router.refresh();
    } else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setFormError(res.error);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {success && (
        <Alert tone="success">{t.received}</Alert>
      )}
      {formError && !success && <Alert tone="danger">{formError}</Alert>}

      <Field
        label={t.amountLabel}
        htmlFor="amount"
        error={errors.amount}
        hint={localHint ?? t.amountHint(minDeposit)}
      >
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          dir="ltr"
          placeholder="10.00"
          invalid={!!errors.amount}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </Field>

      <Field
        label={t.proofLabel}
        htmlFor="proof"
        error={errors.proof}
        hint={t.proofHint}
      >
        <Input
          id="proof"
          name="proof"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="pt-2 file:ml-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-gold"
          invalid={!!errors.proof}
          required
        />
      </Field>

      <Button type="submit" loading={loading} className="w-full">
        <Upload className="h-4 w-4" />
        {t.submit}
      </Button>
    </form>
  );
}
