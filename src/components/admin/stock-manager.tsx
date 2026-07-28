"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPost } from "@/lib/api-client";

interface StockItem {
  id: string;
  packageId: string | null;
  content: string;
  status: "available" | "sold";
  soldAt: string | null;
}

const areaCls =
  "w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono";

/**
 * إدارة مخزون التسليم الفوري لمنتج: إضافة أكواد/حسابات (سطر لكل عنصر)،
 * عرض المتاح/المُباع، وحذف المتاح.
 */
export function StockManager({
  productId,
  packages,
}: {
  productId: string;
  packages: { id: string; name: string }[];
}) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [counts, setCounts] = useState({ available: 0, sold: 0 });
  const [lines, setLines] = useState("");
  const [packageId, setPackageId] = useState<string>(packages[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/products/${productId}/stock`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) {
      setItems(j.data.items);
      setCounts({ available: j.data.available, sold: j.data.sold });
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!lines.trim()) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const res = await apiPost<{ added: number }>(
      `/api/admin/products/${productId}/stock`,
      { lines, packageId: packageId || null },
    );
    setLoading(false);
    if (res.ok) {
      setLines("");
      setNotice(`أُضيف ${res.data.added} عنصرًا للمخزون.`);
      load();
    } else {
      setError(res.error);
    }
  }

  async function remove(itemId: string) {
    setError(null);
    const r = await fetch(`/api/admin/products/${productId}/stock`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) load();
    else setError(j?.error ?? "تعذّر الحذف.");
  }

  const pkgName = (id: string | null) =>
    id ? (packages.find((p) => p.id === id)?.name ?? "بكج محذوف") : "عام";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="h-5 w-5 text-gold" />
          مخزون التسليم الفوري
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge tone={counts.available > 0 ? "success" : "danger"}>
            متاح: {counts.available}
          </Badge>
          <Badge tone="neutral">مُباع: {counts.sold}</Badge>
          <Button type="button" size="icon" variant="ghost" onClick={load} aria-label="تحديث">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <div className="space-y-2">
          <p className="text-xs text-muted">
            أدخل كل كود/حساب في سطر مستقل — يُسلَّم للعميل تلقائيًا فور الدفع.
          </p>
          {packages.length > 0 && (
            <select
              className="h-11 w-full max-w-xs rounded-lg border border-border bg-input px-3 text-sm"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  للبكج: {p.name}
                </option>
              ))}
            </select>
          )}
          <textarea
            className={areaCls}
            dir="ltr"
            rows={5}
            placeholder={"CODE-1111-2222\nuser1@mail.com:password1\n..."}
            value={lines}
            onChange={(e) => setLines(e.target.value)}
          />
          <Button type="button" loading={loading} onClick={add}>
            <Plus className="h-4 w-4" />
            إضافة للمخزون
          </Button>
        </div>

        {items.length > 0 && (
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-xs hover:bg-surface-2/60"
              >
                <span className="truncate font-mono" dir="ltr">
                  {it.content}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-muted">{pkgName(it.packageId)}</span>
                  <Badge tone={it.status === "available" ? "success" : "neutral"}>
                    {it.status === "available" ? "متاح" : "مُباع"}
                  </Badge>
                  {it.status === "available" && (
                    <button
                      type="button"
                      className="text-danger/70 hover:text-danger"
                      onClick={() => remove(it.id)}
                      aria-label="حذف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
