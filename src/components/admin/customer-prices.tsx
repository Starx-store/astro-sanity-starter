"use client";

import { useCallback, useEffect, useState } from "react";
import { Tag, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

interface PriceRow {
  price: {
    id: string;
    productId: string;
    packageId: string | null;
    price: string;
    note: string | null;
  };
  productName: string;
  productType: "package" | "quantity";
  packageName: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  type: "package" | "quantity";
  packages: { id: string; name: string }[];
}

const selectCls =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** أسعار خاصة لعميل — تتقدّم على سعر التاجر وخصومات الباقات. */
export function CustomerPrices({
  userId,
  productOptions,
}: {
  userId: string;
  productOptions: ProductOption[];
}) {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [productId, setProductId] = useState(productOptions[0]?.id ?? "");
  const [packageId, setPackageId] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = productOptions.find((p) => p.id === productId);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/users/${userId}/prices`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) setRows(j.data.items);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // إعادة ضبط البكج عند تبديل المنتج.
  useEffect(() => {
    setPackageId(selected?.packages[0]?.id ?? "");
  }, [productId, selected]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const res = await apiPost(`/api/admin/users/${userId}/prices`, {
      productId,
      packageId: selected?.type === "package" ? packageId : null,
      price,
    });
    setLoading(false);
    if (res.ok) {
      setPrice("");
      setNotice("حُفظ السعر الخاص.");
      load();
    } else {
      setError(
        res.fieldErrors ? Object.values(res.fieldErrors).join(" · ") : res.error,
      );
    }
  }

  async function remove(priceId: string) {
    const r = await fetch(`/api/admin/users/${userId}/prices`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    if (r.ok) load();
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {rows.length > 0 && (
        <div className="space-y-1 rounded-lg border border-border p-2">
          {rows.map((r) => (
            <div
              key={r.price.id}
              className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-surface-2/60"
            >
              <span className="truncate">
                <span className="font-medium">{r.productName}</span>
                {r.packageName ? ` · ${r.packageName}` : ""}
                {r.productType === "quantity" ? " (لكل 1000)" : ""}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-bold text-gold" dir="ltr">
                  {r.price.price}$
                </span>
                <button
                  type="button"
                  className="text-danger/70 hover:text-danger"
                  onClick={() => remove(r.price.id)}
                  aria-label="حذف السعر"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {productOptions.length === 0 ? (
        <p className="text-xs text-muted">أنشئ منتجًا أولًا.</p>
      ) : (
        <form onSubmit={add} className="space-y-3">
          <Field label="المنتج">
            <select
              className={selectCls}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          {selected?.type === "package" && (
            <Field label="البكج">
              <select
                className={selectCls}
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
              >
                {selected.packages.map((pk) => (
                  <option key={pk.id} value={pk.id}>
                    {pk.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label={
              selected?.type === "quantity"
                ? "السعر الخاص لكل 1000 $"
                : "السعر الخاص $"
            }
          >
            <Input
              dir="ltr"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>

          <Button type="submit" size="sm" className="w-full" loading={loading}>
            <Plus className="h-4 w-4" />
            حفظ السعر الخاص
          </Button>
          <p className="flex items-start gap-1 text-[11px] text-muted">
            <Tag className="mt-0.5 h-3 w-3 shrink-0" />
            يتقدّم هذا السعر على سعر التاجر وخصومات الباقات لهذا العميل.
          </p>
        </form>
      )}
    </div>
  );
}
