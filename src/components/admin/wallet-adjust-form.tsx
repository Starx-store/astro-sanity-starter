"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

/** نموذج إضافة/خصم رصيد لمستخدم (لوحة الأدمن). */
export function WalletAdjustForm({ userId }: { userId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    setSuccess(null);

    const fd = new FormData(e.currentTarget);
    const res = await apiPost<{ transaction: { referenceNo: string } }>(
      `/api/admin/users/${userId}/wallet-adjust`,
      {
        direction: fd.get("direction"),
        amount: fd.get("amount"),
        reason: fd.get("reason"),
      },
    );
    setLoading(false);

    if (res.ok) {
      setSuccess(`تم تنفيذ العملية — المرجع ${res.data.transaction.referenceNo}`);
      formRef.current?.reset();
      router.refresh();
    } else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setFormError(res.error);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {success && <Alert tone="success">{success}</Alert>}
      {formError && !success && <Alert tone="danger">{formError}</Alert>}

      <Field label="نوع العملية" htmlFor="direction" error={errors.direction}>
        <select
          id="direction"
          name="direction"
          className="h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue="credit"
        >
          <option value="credit">إضافة رصيد</option>
          <option value="debit">خصم رصيد</option>
        </select>
      </Field>

      <Field label="المبلغ (USD)" htmlFor="adj-amount" error={errors.amount}>
        <Input
          id="adj-amount"
          name="amount"
          inputMode="decimal"
          dir="ltr"
          placeholder="10.00"
          invalid={!!errors.amount}
          required
        />
      </Field>

      <Field
        label="السبب"
        htmlFor="adj-reason"
        error={errors.reason}
        hint="يُسجَّل في سجل التدقيق ويظهر للعميل في الإشعار."
      >
        <Input
          id="adj-reason"
          name="reason"
          placeholder="مثال: تعويض عن طلب متأخر"
          invalid={!!errors.reason}
          required
        />
      </Field>

      <Button type="submit" loading={loading} className="w-full">
        تنفيذ العملية
      </Button>
    </form>
  );
}
