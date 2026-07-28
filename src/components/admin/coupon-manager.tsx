"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket, Plus, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiPost } from "@/lib/api-client";

interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: string;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  minAmount: string | null;
  endsAt: string | null;
  isActive: boolean;
}

const selectCls =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** إدارة كوبونات الخصم. */
export function CouponManager() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [minAmount, setMinAmount] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/coupons", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) setItems(j.data.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const res = await apiPost("/api/admin/coupons", {
      code,
      type,
      value,
      maxUses: maxUses ? Number(maxUses) : undefined,
      perUserLimit: perUserLimit ? Number(perUserLimit) : undefined,
      minAmount,
      endsAt,
      isActive: true,
    });
    setLoading(false);
    if (res.ok) {
      setCode("");
      setNotice("أُنشئ الكوبون.");
      load();
    } else {
      setError(
        res.fieldErrors ? Object.values(res.fieldErrors).join(" · ") : res.error,
      );
    }
  }

  async function disable(id: string) {
    const r = await fetch("/api/admin/coupons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (r.ok) load();
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <form
        onSubmit={create}
        className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-4 sm:grid-cols-12"
      >
        <div className="sm:col-span-3">
          <Field label="الرمز">
            <Input
              dir="ltr"
              placeholder="WELCOME10"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="النوع">
            <select
              className={selectCls}
              value={type}
              onChange={(e) => setType(e.target.value as "percent" | "fixed")}
            >
              <option value="percent">نسبة ٪</option>
              <option value="fixed">مبلغ $</option>
            </select>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={type === "percent" ? "النسبة ٪" : "المبلغ $"}>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="أقصى استخدام" hint="فارغ = بلا حد">
            <Input
              dir="ltr"
              inputMode="numeric"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="لكل عميل" hint="فارغ = بلا حد">
            <Input
              dir="ltr"
              inputMode="numeric"
              value={perUserLimit}
              onChange={(e) => setPerUserLimit(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-4">
          <Field label="أقل قيمة طلب $ (اختياري)">
            <Input
              dir="ltr"
              inputMode="decimal"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-4">
          <Field label="ينتهي في (اختياري)">
            <Input
              type="date"
              dir="ltr"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex items-end sm:col-span-4">
          <Button type="submit" className="w-full" loading={loading}>
            <Plus className="h-4 w-4" />
            إنشاء كوبون
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          لا كوبونات بعد.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                <th className="px-4 py-3 font-medium">الرمز</th>
                <th className="px-4 py-3 font-medium">الخصم</th>
                <th className="px-4 py-3 font-medium">الاستخدام</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold" dir="ltr">
                      {c.code}
                    </span>
                    {c.minAmount && (
                      <p className="text-[11px] text-muted">
                        أقل طلب {c.minAmount}$
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {c.type === "percent" ? `${c.value}%` : `${c.value}$`}
                  </td>
                  <td className="px-4 py-3 text-muted" dir="ltr">
                    {c.usedCount}
                    {c.maxUses ? ` / ${c.maxUses}` : ""}
                    {c.perUserLimit ? ` (${c.perUserLimit}/عميل)` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={c.isActive ? "success" : "neutral"}>
                      {c.isActive ? "فعّال" : "معطّل"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {c.isActive && (
                      <button
                        type="button"
                        onClick={() => disable(c.id)}
                        className="flex items-center gap-1 text-xs text-danger/80 hover:text-danger"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        تعطيل
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-start gap-1 text-xs text-muted">
        <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        يُطبَّق الكوبون على إجمالي الطلب بعد كل الأسعار والخصومات الأخرى.
      </p>
    </div>
  );
}
