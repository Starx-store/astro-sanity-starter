"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    department: "القسم",
    deptGeneral: "عام",
    deptOrders: "الطلبات",
    deptPayments: "المدفوعات",
    deptTechnical: "تقني",
    priority: "الأولوية",
    prLow: "منخفضة",
    prNormal: "عادية",
    prHigh: "عاجلة",
    linkOrder: "ربط بطلب (اختياري)",
    none: "— بدون —",
    subject: "العنوان",
    details: "التفاصيل",
    submit: "إرسال التذكرة",
  },
  en: {
    department: "Department",
    deptGeneral: "General",
    deptOrders: "Orders",
    deptPayments: "Payments",
    deptTechnical: "Technical",
    priority: "Priority",
    prLow: "Low",
    prNormal: "Normal",
    prHigh: "Urgent",
    linkOrder: "Link to an order (optional)",
    none: "— None —",
    subject: "Subject",
    details: "Details",
    submit: "Submit ticket",
  },
} as const;

const selectCls =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function NewTicketForm({
  orders,
}: {
  orders: { id: string; orderNo: string }[];
}) {
  const router = useRouter();
  const t = T[useLocale()];
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    const res = await apiPost<{ ticket: { id: string } }>("/api/support", {
      department: fd.get("department"),
      priority: fd.get("priority"),
      relatedOrderId: fd.get("relatedOrderId") || undefined,
      subject: fd.get("subject"),
      body: fd.get("body"),
    });
    setLoading(false);
    if (res.ok) {
      router.push(`/support/${res.data.ticket.id}`);
      router.refresh();
    } else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setFormError(res.error);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.department} error={errors.department}>
          <select name="department" className={selectCls} defaultValue="general">
            <option value="general">{t.deptGeneral}</option>
            <option value="orders">{t.deptOrders}</option>
            <option value="payments">{t.deptPayments}</option>
            <option value="technical">{t.deptTechnical}</option>
          </select>
        </Field>
        <Field label={t.priority} error={errors.priority}>
          <select name="priority" className={selectCls} defaultValue="normal">
            <option value="low">{t.prLow}</option>
            <option value="normal">{t.prNormal}</option>
            <option value="high">{t.prHigh}</option>
          </select>
        </Field>
      </div>
      {orders.length > 0 && (
        <Field label={t.linkOrder} error={errors.relatedOrderId}>
          <select name="relatedOrderId" className={selectCls} defaultValue="">
            <option value="">{t.none}</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNo}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={t.subject} htmlFor="subject" error={errors.subject}>
        <Input id="subject" name="subject" invalid={!!errors.subject} required />
      </Field>
      <Field label={t.details} htmlFor="body" error={errors.body}>
        <textarea
          id="body"
          name="body"
          rows={5}
          className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </Field>
      <Button type="submit" loading={loading}>
        {t.submit}
      </Button>
    </form>
  );
}
