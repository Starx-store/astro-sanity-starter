"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

type LinkRow = {
  id: string;
  productId: string;
  productName: string;
  externalProductId: string;
  externalPrice: string | null;
};

export function ProductLinkManager({
  providerId,
  links,
  products,
}: {
  providerId: string;
  links: LinkRow[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [externalProductId, setExternalProductId] = useState("");
  const [externalPrice, setExternalPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiPost(`/api/admin/providers/${providerId}/link`, {
      productId,
      externalProductId,
      externalPrice,
    });
    setLoading(false);
    if (res.ok) {
      setExternalProductId("");
      setExternalPrice("");
      router.refresh();
    } else {
      setError(
        res.fieldErrors ? Object.values(res.fieldErrors).join(" · ") : res.error,
      );
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/provider-links/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      {links.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">
          لا توجد منتجات مرتبطة بهذا المزوّد بعد.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                <th className="px-4 py-3 font-medium">المنتج</th>
                <th className="px-4 py-3 font-medium">المعرّف الخارجي</th>
                <th className="px-4 py-3 font-medium">سعر المزوّد</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{l.productName}</td>
                  <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                    {l.externalProductId}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {l.externalPrice ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="إزالة الربط"
                      loading={deletingId === l.id}
                      onClick={() => remove(l.id)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {products.length > 0 ? (
        <form
          onSubmit={add}
          className="grid items-end gap-3 rounded-lg border border-border bg-surface-2/40 p-4 sm:grid-cols-12"
        >
          <div className="sm:col-span-4">
            <Field label="المنتج">
              <select
                className="h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Field label="المعرّف لدى المزوّد">
              <Input
                dir="ltr"
                value={externalProductId}
                onChange={(e) => setExternalProductId(e.target.value)}
                placeholder="service id"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="سعره $">
              <Input
                dir="ltr"
                inputMode="decimal"
                value={externalPrice}
                onChange={(e) => setExternalPrice(e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={loading} className="w-full">
              <Plus className="h-4 w-4" />
              ربط
            </Button>
          </div>
        </form>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Link2 className="h-4 w-4" />
          أنشئ منتجًا أولًا لربطه بالمزوّد.
        </p>
      )}
    </div>
  );
}
