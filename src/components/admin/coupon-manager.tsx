"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket, Plus, Ban, Eye, X, UserCheck } from "lucide-react";
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
  productId: string | null;
  productName: string | null;
  isActive: boolean;
}

interface ProductItem {
  id: string;
  name: string;
}

interface Redemption {
  id: string;
  amountOff: string;
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  orderId: string | null;
  orderNo: string | null;
}

const selectCls =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** إدارة كوبونات الخصم مع تخصيص المنتجات وسجل الاستخدامات. */
export function CouponManager() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [minAmount, setMinAmount] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // حالة النوافذ المنبثقة لرؤية من استخدم الكوبون
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/coupons", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) {
      setItems(j.data.items);
      setProductsList(j.data.productsList || []);
    }
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
      productId: productId.trim() || undefined,
      isActive: true,
    });
    setLoading(false);
    if (res.ok) {
      setCode("");
      setNotice("أُنشئ الكوبون بنجاح.");
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

  async function viewRedemptions(coupon: Coupon) {
    setSelectedCoupon(coupon);
    setLoadingRedemptions(true);
    setRedemptions([]);
    const r = await fetch(`/api/admin/coupons/${coupon.id}/redemptions`, { cache: "no-store" });
    const j = await r.json().catch(() => null);
    setLoadingRedemptions(false);
    if (r.ok && j?.ok) {
      setRedemptions(j.data.redemptions || []);
    }
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <form
        onSubmit={create}
        className="grid gap-3 rounded-xl border border-border bg-surface-2/40 p-5 sm:grid-cols-12"
      >
        <div className="sm:col-span-3">
          <Field label="رمز الكوبون">
            <Input
              dir="ltr"
              placeholder="PROMO15"
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
        <div className="sm:col-span-5">
          <Field label="تخصيص لمنتج معين (اختياري)">
            <select
              className={selectCls}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">— شامل لجميع المنتجات —</option>
              {productsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="أقصى استخدام إجمالي" hint="فارغ = بلا حد">
            <Input
              dir="ltr"
              inputMode="numeric"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="حد الاستخدام لكل عميل" hint="فارغ = بلا حد">
            <Input
              dir="ltr"
              inputMode="numeric"
              value={perUserLimit}
              onChange={(e) => setPerUserLimit(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="أقل قيمة طلب $ (اختياري)">
            <Input
              dir="ltr"
              inputMode="decimal"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="ينتهي في (اختياري)">
            <Input
              type="date"
              dir="ltr"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex items-end sm:col-span-12">
          <Button type="submit" className="w-full sm:w-auto px-8 font-bold" loading={loading}>
            <Plus className="h-4 w-4" />
            إنشاء كوبون الخصم
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          لا توجد كوبونات مضافة بعد.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                <th className="px-4 py-3 font-medium">الرمز والتخصيص</th>
                <th className="px-4 py-3 font-medium">قيمة الخصم</th>
                <th className="px-4 py-3 font-medium">الاستخدام</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium text-center">سجل المستفيدين</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-4 py-3">
                    <span className="font-mono font-black text-gold text-base" dir="ltr">
                      {c.code}
                    </span>
                    {c.productName ? (
                      <p className="text-[11px] font-bold text-amber-400 mt-0.5">
                        🎯 مخصص لمنتج: {c.productName}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted mt-0.5">
                        🌐 شامل لجميع المنتجات
                      </p>
                    )}
                    {c.minAmount && (
                      <p className="text-[10px] text-muted">
                        أقل طلب ${c.minAmount}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold" dir="ltr">
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
                  <td className="px-4 py-3 text-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="subtle"
                      onClick={() => viewRedemptions(c)}
                      className="text-xs font-bold gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      من استخدمه ({c.usedCount})
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    {c.isActive && (
                      <button
                        type="button"
                        onClick={() => disable(c.id)}
                        className="flex items-center gap-1 text-xs text-danger/80 hover:text-danger font-medium"
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

      {/* نافذة عرض قائمة العملاء الذين استخدموا الكوبون */}
      {selectedCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl glass-card-pro border border-border p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-gold" />
                  سجل العملاء المستفيدين من الكوبون (
                  <span className="font-mono text-gold" dir="ltr">{selectedCoupon.code}</span>)
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  إجمالي الاستخدامات: {selectedCoupon.usedCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCoupon(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingRedemptions ? (
                <div className="p-8 text-center text-sm text-muted">جارٍ جلب السجل…</div>
              ) : redemptions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted border border-dashed border-border/60 rounded-xl">
                  لم يقم أي عميل باستخدام هذا الكوبون بعد.
                </div>
              ) : (
                <div className="space-y-2">
                  {redemptions.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-2/40 p-3.5 text-xs"
                    >
                      <div>
                        <span className="block font-bold text-foreground text-sm">
                          {r.userName}
                        </span>
                        <span className="text-muted text-[11px]">{r.userEmail}</span>
                        {r.orderNo && (
                          <span className="mt-1 block text-[11px] font-mono text-gold" dir="ltr">
                            طلب رقم: #{r.orderNo}
                          </span>
                        )}
                      </div>
                      <div className="text-left">
                        <span className="block font-extrabold text-emerald-400 text-sm" dir="ltr">
                          خصم: ${r.amountOff}
                        </span>
                        <span className="text-[10px] text-muted">
                          {new Date(r.createdAt).toLocaleString("ar-SA")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="flex items-start gap-1 text-xs text-muted">
        <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        يُطبق الكوبون على الطلب ويحسب الخصم تلقائياً حسب نوعه وتخصيصه.
      </p>
    </div>
  );
}
