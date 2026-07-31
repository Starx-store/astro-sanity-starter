"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    choosePkg: "اختر البكج",
    qtyLabel: (unit: string) => `الكمية (${unit})`,
    qtyHint: (min: string, max: string | null) =>
      `من ${min}${max ? ` إلى ${max}` : ""}`,
    optional: (label: string) => `${label} (اختياري)`,
    coupon: "كوبون خصم (اختياري)",
    estTotal: "الإجمالي التقريبي",
    topUp: "{t.topUp}",
    unavailable: "هذا المنتج غير متاح للطلب حاليًا.",
    loginToOrder: "سجّل الدخول للطلب",
    buyNow: "شراء الآن",
    confirmTitle: "تأكيد الطلب",
    close: "إغلاق",
    product: "المنتج",
    pkg: "البكج",
    qty: "الكمية",
    total: "الإجمالي",
    approx: "بالتحويل التقريبي",
    balanceAfter: "الرصيد المتبقي بعد الشراء",
    serverNote:
      "السعر النهائي يُحتسب من الخادم، وسيُحجز المبلغ من محفظتك حتى اكتمال التنفيذ.",
    confirmBuy: "تأكيد الشراء",
    cancel: "إلغاء",
  },
  en: {
    choosePkg: "Choose a package",
    qtyLabel: (unit: string) => `Quantity (${unit})`,
    qtyHint: (min: string, max: string | null) =>
      `From ${min}${max ? ` to ${max}` : ""}`,
    optional: (label: string) => `${label} (optional)`,
    coupon: "Coupon code (optional)",
    estTotal: "Estimated total",
    topUp: "Top up your wallet",
    unavailable: "This product is currently unavailable for ordering.",
    loginToOrder: "Sign in to order",
    buyNow: "Buy Now",
    confirmTitle: "Confirm Order",
    close: "Close",
    product: "Product",
    pkg: "Package",
    qty: "Quantity",
    total: "Total",
    approx: "Approx. conversion",
    balanceAfter: "Balance after purchase",
    serverNote:
      "The final price is calculated by the server, and the amount will be held from your wallet until the order is completed.",
    confirmBuy: "Confirm Purchase",
    cancel: "Cancel",
  },
} as const;

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "email" | "number";
  required: boolean;
};

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  salePrice: string;
  packageType?: "fixed" | "quantity";
  pricePer1000?: string | null;
  minQty?: string | null;
  maxQty?: string | null;
};

type QtyInfo = {
  unit: string;
  minQty: string;
  maxQty: string | null;
  pricePerUnit: string | null;
  pricePer1000: string | null;
  tiers: { minQty: string; maxQty: string | null; pricePerUnit: string }[];
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 8 });

export function OrderBox(props: {
  productId: string;
  productName: string;
  productType: "package" | "quantity";
  orderable: boolean;
  packages: Pkg[];
  qty: QtyInfo | null;
  requiredFields: FieldDef[];
  isLoggedIn: boolean;
  availableBalance: string | null;
  loginNext: string;
  /** عملة عرض اختيارية — التحويل تقريبي والدفع بالدولار. */
  currency?: { label: string; rate: number } | null;
}) {
  const router = useRouter();
  const t = T[useLocale()];
  const [packageId, setPackageId] = useState<string | null>(
    props.packages[0]?.id ?? null,
  );
  const [quantity, setQuantity] = useState(props.qty?.minQty ?? "");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [idemKey, setIdemKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponData, setCouponData] = useState<{
    code: string;
    type: "percent" | "fixed";
    value: string;
    amountOff: string;
    newTotal: string;
  } | null>(null);

  const selectedPkg = useMemo(
    () => props.packages.find((p) => p.id === packageId),
    [props.packages, packageId],
  );

  async function checkCoupon() {
    if (!couponCode.trim()) {
      setCouponData(null);
      setCouponError(null);
      return;
    }
    setCheckingCoupon(true);
    setCouponError(null);
    setCouponData(null);
    const res = await apiPost<{
      code: string;
      type: "percent" | "fixed";
      value: string;
      amountOff: string;
      newTotal: string;
    }>("/api/orders/preview-coupon", {
      code: couponCode.trim(),
      productId: props.productId,
      total: preview !== null ? String(preview) : "1.0",
    });
    setCheckingCoupon(false);
    if (res.ok) {
      setCouponData(res.data);
    } else {
      setCouponError(res.error);
    }
  }

  /** معاينة السعر (عرض فقط — الحساب النهائي من الخادم دائمًا). */
  const preview = useMemo(() => {
    if (props.productType === "package") {
      if (!selectedPkg) return null;
      if (selectedPkg.packageType === "quantity") {
        const q = Number(quantity);
        if (!quantity || Number.isNaN(q) || q <= 0) return null;
        const p1000 = Number(selectedPkg.pricePer1000 || selectedPkg.salePrice);
        return (p1000 * q) / 1000;
      }
      return Number(selectedPkg.salePrice);
    }
    const q = Number(quantity);
    if (!props.qty || !quantity || Number.isNaN(q) || q <= 0) return null;
    let unit: number | null = null;
    for (const t of props.qty.tiers) {
      if (q >= Number(t.minQty) && (t.maxQty == null || q <= Number(t.maxQty))) {
        unit = Number(t.pricePerUnit);
      }
    }
    if (unit === null && props.qty.pricePerUnit) unit = Number(props.qty.pricePerUnit);
    if (unit === null && props.qty.pricePer1000) unit = Number(props.qty.pricePer1000) / 1000;
    return unit === null ? null : unit * q;
  }, [props.productType, props.qty, selectedPkg, quantity]);

  const balance = props.availableBalance ? Number(props.availableBalance) : null;
  const after = balance !== null && preview !== null ? balance - preview : null;

  function openConfirm() {
    setErrors({});
    setFormError(null);
    setErrCode(null);
    if (!props.isLoggedIn && (!guestEmail.trim() || !guestEmail.includes("@"))) {
      setFormError("يرجى إدخال بريد إلكتروني صحيح للشراء السريع.");
      return;
    }
    setIdemKey(crypto.randomUUID());
    setConfirming(true);
  }

  async function submit() {
    if (!idemKey) return;
    setLoading(true);
    setFormError(null);
    setErrors({});
    setErrCode(null);

    const res = await apiPost<{ orderNo: string }>("/api/orders", {
      productId: props.productId,
      packageId: props.productType === "package" ? packageId : undefined,
      quantity:
        props.productType === "quantity" || selectedPkg?.packageType === "quantity"
          ? quantity
          : undefined,
      inputs,
      couponCode: couponCode.trim() || undefined,
      guestEmail: guestEmail.trim() || undefined,
      idempotencyKey: idemKey,
    });
    setLoading(false);

    if (res.ok) {
      router.push(`/orders?created=${res.data.orderNo}`);
    } else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setFormError(res.error);
      setErrCode(res.code ?? null);
    }
  }

  if (!props.orderable) {
    return (
      <Alert tone="warning" title={t.unavailable}>
        {t.unavailable}
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {formError && (
        <Alert tone="danger" className="text-xs">
          {formError}
          {errCode === "insufficient_balance" && props.isLoggedIn && (
            <div className="mt-2">
              <Link
                href="/wallet"
                className="font-bold underline hover:text-gold"
              >
                {t.topUp} 👈
              </Link>
            </div>
          )}
        </Alert>
      )}

      {/* قائمة البكجات */}
      {props.productType === "package" && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">{t.choosePkg}</label>
          <div className="grid gap-2">
            {props.packages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPackageId(p.id);
                  if (p.packageType === "quantity" && !quantity) {
                    setQuantity(p.minQty ?? "1000");
                  }
                }}
                className={cn(
                  "rounded-lg border p-4 text-right transition-colors",
                  packageId === p.id
                    ? "border-gold bg-gold/10"
                    : "border-border bg-surface-2/40 hover:border-gold/40",
                )}
              >
                <span className="block font-semibold">{p.name}</span>
                {p.description && (
                  <span className="mt-1 block text-xs text-muted">
                    {p.description}
                  </span>
                )}
                <span className="mt-2 block font-extrabold text-gold" dir="ltr">
                  {p.packageType === "quantity"
                    ? `${fmt(Number(p.pricePer1000 || p.salePrice))}$ / 1000`
                    : `${fmt(Number(p.salePrice))}$`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* إدخال الكمية لبكج فرعي يعتمد الكمية */}
      {props.productType === "package" && selectedPkg?.packageType === "quantity" && (
        <Field
          label={t.qty}
          htmlFor="package-quantity"
          error={errors.quantity}
          hint={t.qtyHint(selectedPkg.minQty || "1", selectedPkg.maxQty || null)}
        >
          <Input
            id="package-quantity"
            inputMode="decimal"
            dir="ltr"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            invalid={!!errors.quantity}
          />
        </Field>
      )}

      {/* إدخال الكمية لمنتج كامل من نوع كمية */}
      {props.productType === "quantity" && props.qty && (
        <Field
          label={t.qtyLabel(props.qty.unit)}
          htmlFor="quantity"
          error={errors.quantity}
          hint={t.qtyHint(props.qty.minQty, props.qty.maxQty)}
        >
          <Input
            id="quantity"
            inputMode="decimal"
            dir="ltr"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            invalid={!!errors.quantity}
          />
        </Field>
      )}

      {/* الحقول المطلوبة */}
      {props.requiredFields.map((f) => (
        <Field
          key={f.key}
          label={f.required ? f.label : t.optional(f.label)}
          htmlFor={`rf-${f.key}`}
          error={errors[f.key]}
        >
          {f.type === "textarea" ? (
            <textarea
              id={`rf-${f.key}`}
              rows={3}
              value={inputs[f.key] ?? ""}
              onChange={(e) =>
                setInputs((s) => ({ ...s, [f.key]: e.target.value }))
              }
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <Input
              id={`rf-${f.key}`}
              type={f.type === "number" ? "text" : f.type}
              dir={f.type === "text" || f.type === "textarea" ? undefined : "ltr"}
              value={inputs[f.key] ?? ""}
              onChange={(e) =>
                setInputs((s) => ({ ...s, [f.key]: e.target.value }))
              }
              invalid={!!errors[f.key]}
            />
          )}
        </Field>
      ))}

      {/* كوبون الخصم */}
      {props.isLoggedIn && props.orderable && (
        <div className="space-y-2">
          <Field label={t.coupon} error={errors.couponCode || (couponError ?? undefined)}>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                placeholder="CODE"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  if (couponData) setCouponData(null);
                  if (couponError) setCouponError(null);
                }}
              />
              <Button
                type="button"
                variant="subtle"
                loading={checkingCoupon}
                disabled={!couponCode.trim()}
                onClick={checkCoupon}
                className="shrink-0"
              >
                فحص الكوبون
              </Button>
            </div>
          </Field>

          {couponData && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>🏷️ كوبون خصم مفعّل ({couponData.type === "percent" ? `خصم ${couponData.value}%` : `خصم $${couponData.value}`})</span>
                <span dir="ltr">-{couponData.amountOff}$</span>
              </div>
              {preview !== null && (
                <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-muted">
                  <span>السعر بعد الخصم:</span>
                  <span className="text-sm font-black text-emerald-300" dir="ltr">
                    ${fmt(Math.max(0, preview - Number(couponData.amountOff)))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* السعر */}
      <div className="rounded-lg border border-border bg-surface-2/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{t.estTotal}</span>
          <div className="text-right">
            {couponData && preview !== null ? (
              <div>
                <span className="block text-xs text-muted line-through" dir="ltr">
                  ${fmt(preview)}
                </span>
                <span className="text-xl font-extrabold text-emerald-400" dir="ltr">
                  ${fmt(Math.max(0, preview - Number(couponData.amountOff)))}
                </span>
              </div>
            ) : (
              <span className="text-xl font-extrabold text-gradient-gold" dir="ltr">
                {preview !== null ? `${fmt(preview)}$` : "—"}
              </span>
            )}
          </div>
        </div>
        {props.currency && preview !== null && (
          <p className="mt-1 text-left text-xs text-muted" dir="ltr">
            ≈{" "}
            {((couponData ? Math.max(0, preview - Number(couponData.amountOff)) : preview) * props.currency.rate).toLocaleString("en-US", {
              maximumFractionDigits: preview * props.currency.rate >= 100 ? 0 : 2,
            })}{" "}
            {props.currency.label}
          </p>
        )}
      </div>

      {formError && !confirming && (
        <Alert tone="danger">
          {formError}
          {errCode === "insufficient_funds" && (
            <>
              {" "}
              <Link href="/wallet" className="font-medium underline">
                {t.topUp}
              </Link>
            </>
          )}
        </Alert>
      )}

      {!props.orderable ? (
        <Alert tone="warning">{t.unavailable}</Alert>
      ) : !props.isLoggedIn ? (
        <div className="space-y-3 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-surface-2/40 to-surface p-4 text-right shadow-lg">
          <div className="flex items-center gap-2 text-gold font-black text-sm">
            <Zap className="h-4 w-4 text-gold animate-bounce" />
            <span>الشراء السريع للزوار (بدون كلمة سر)</span>
          </div>
          <Field label="أدخل بريدك الإلكتروني" htmlFor="guest-email" error={errors.guestEmail}>
            <Input
              id="guest-email"
              type="email"
              dir="ltr"
              placeholder="yourname@gmail.com"
              value={guestEmail}
              onChange={(e) => {
                setGuestEmail(e.target.value);
                if (formError) setFormError(null);
              }}
            />
          </Field>
          <Button
            className="w-full font-bold bg-gradient-to-r from-amber-500 via-gold to-gold-strong text-gold-foreground shadow-lg shadow-gold/20 hover:shadow-gold/30"
            size="lg"
            onClick={openConfirm}
            disabled={preview === null || !guestEmail.trim()}
          >
            <ShoppingCart className="h-5 w-5" />
            شراء الآن كـ زائر ⚡
          </Button>
          <div className="text-center pt-1 border-t border-border/40">
            <Link
              href={`/login?next=${encodeURIComponent(props.loginNext)}`}
              className="text-xs font-semibold text-muted hover:text-gold hover:underline transition-colors"
            >
              أو سجّل الدخول بحسابك السابق ←
            </Link>
          </div>
        </div>
      ) : (
        <Button
          className="w-full"
          size="lg"
          onClick={openConfirm}
          disabled={preview === null}
        >
          <ShoppingCart className="h-5 w-5" />
          {t.buyNow}
        </Button>
      )}

      {/* نافذة التأكيد */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md animate-fade-in p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t.confirmTitle}</h3>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-muted hover:text-foreground"
                aria-label={t.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted">{t.product}</span>
                <span className="font-medium">{props.productName}</span>
              </div>
              {selectedPkg && props.productType === "package" && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted">{t.pkg}</span>
                  <span className="font-medium">{selectedPkg.name}</span>
                </div>
              )}
              {props.productType === "quantity" && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted">{t.qty}</span>
                  <span className="font-medium" dir="ltr">
                    {quantity} {props.qty?.unit}
                  </span>
                </div>
              )}
              {Object.entries(inputs)
                .filter(([, v]) => v.trim())
                .map(([k, v]) => {
                  const def = props.requiredFields.find((f) => f.key === k);
                  return (
                    <div key={k} className="flex justify-between gap-4">
                      <span className="text-muted">{def?.label ?? k}</span>
                      <span className="max-w-[220px] truncate font-medium" dir="auto">
                        {v}
                      </span>
                    </div>
                  );
                })}
              <div className="my-3 border-t border-border" />
              <div className="flex justify-between gap-4">
                <span className="text-muted">{t.total}</span>
                <span className="font-extrabold text-gold" dir="ltr">
                  {preview !== null ? `${fmt(preview)}$` : "—"}
                </span>
              </div>
              {props.currency && preview !== null && (
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-muted">{t.approx}</span>
                  <span className="text-muted" dir="ltr">
                    ≈{" "}
                    {(preview * props.currency.rate).toLocaleString("en-US", {
                      maximumFractionDigits:
                        preview * props.currency.rate >= 100 ? 0 : 2,
                    })}{" "}
                    {props.currency.label}
                  </span>
                </div>
              )}
              {balance !== null && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted">{t.balanceAfter}</span>
                  <span
                    className={cn("font-bold", after !== null && after < 0 && "text-danger")}
                    dir="ltr"
                  >
                    {after !== null ? `${fmt(after)}$` : "—"}
                  </span>
                </div>
              )}
              <p className="pt-1 text-xs text-muted">{t.serverNote}</p>
            </div>

            {formError && (
              <Alert tone="danger" className="mt-4">
                {formError}
                {errCode === "insufficient_funds" && (
                  <>
                    {" "}
                    <Link href="/wallet" className="font-medium underline">
                      {t.topUp}
                    </Link>
                  </>
                )}
              </Alert>
            )}

            <div className="mt-5 flex gap-2">
              <Button className="flex-1" loading={loading} onClick={submit}>
                {t.confirmBuy}
              </Button>
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => setConfirming(false)}
              >
                {t.cancel}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
