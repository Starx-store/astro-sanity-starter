"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiPost } from "@/lib/api-client";

interface Service {
  externalId: string;
  name: string;
  category: string | null;
  ratePer1000: string;
  minQty: string | null;
  maxQty: string | null;
  type: string | null;
}

interface CatalogPage {
  items: Service[];
  total: number;
  totalAll: number;
  page: number;
  pageSize: number;
  categories: string[];
  cachedAt: number;
}

const selectCls =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * تصفّح كتالوج المزوّد واستيراد خدمات مختارة كمنتجات.
 * البحث والصفحات تتم على الخادم — الكتالوج قد يضم آلاف الخدمات.
 */
export function ServiceImporter({
  providerId,
  categories,
}: {
  providerId: string;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [data, setData] = useState<CatalogPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Map<string, Service>>(new Map());
  // الأسماء العربية المترجمة للصفحة المعروضة.
  const [arabic, setArabic] = useState<Map<string, string>>(new Map());
  const [markupType, setMarkupType] = useState<"percent" | "fixed">("percent");
  const [markupValue, setMarkupValue] = useState("20");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [publish, setPublish] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(
    async (opts: { page?: number; refresh?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      const p = opts.page ?? page;
      const url = new URL(
        `/api/admin/providers/${providerId}/services`,
        window.location.origin,
      );
      if (q.trim()) url.searchParams.set("q", q.trim());
      if (category) url.searchParams.set("category", category);
      url.searchParams.set("page", String(p));
      if (opts.refresh) url.searchParams.set("refresh", "1");

      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) {
          throw new Error(j?.error ?? `تعذّر جلب الخدمات (${r.status})`);
        }
        const page = j.data as CatalogPage;
        setData(page);
        setPage(p);
        // نجلب الأسماء العربية لهذه الصفحة فقط.
        try {
          const pr = await fetch(
            `/api/admin/providers/${providerId}/services/preview`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                items: page.items.map((s) => ({
                  externalId: s.externalId,
                  name: s.name,
                  category: s.category,
                })),
              }),
            },
          );
          const pj = await pr.json();
          if (pr.ok && pj?.ok) {
            setArabic(
              new Map(
                (pj.data.items as { externalId: string; name: string }[]).map(
                  (i) => [i.externalId, i.name],
                ),
              ),
            );
          }
        } catch {
          /* الترجمة تحسين اختياري — لا نُفشل العرض بسببها */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر جلب الخدمات.");
      } finally {
        setLoading(false);
      }
    },
    [providerId, q, category, page],
  );

  useEffect(() => {
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(s: Service) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(s.externalId)) next.delete(s.externalId);
      else next.set(s.externalId, s);
      return next;
    });
  }

  function toggleAllOnPage() {
    if (!data) return;
    const allSelected = data.items.every((s) => selected.has(s.externalId));
    setSelected((prev) => {
      const next = new Map(prev);
      for (const s of data.items) {
        if (allSelected) next.delete(s.externalId);
        else next.set(s.externalId, s);
      }
      return next;
    });
  }

  /** معاينة سعر البيع بعد الهامش (نفس حساب الخادم). */
  function previewPrice(rate: string): string {
    const r = Number(rate);
    const v = Number(markupValue);
    if (!Number.isFinite(r) || !Number.isFinite(v) || v < 0) return rate;
    const out = markupType === "fixed" ? r + v : r * (1 + v / 100);
    return out.toFixed(4).replace(/\.?0+$/, "");
  }

  async function runImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setError(null);
    setNotice(null);
    const res = await apiPost<{ imported: number; skipped: string[] }>(
      `/api/admin/providers/${providerId}/import`,
      {
        categoryId,
        markupType,
        markupValue,
        publish,
        selections: Array.from(selected.values()).map((s) => ({
          externalId: s.externalId,
          name: s.name,
        })),
      },
    );
    setImporting(false);
    if (res.ok) {
      setSelected(new Map());
      setNotice(
        `تم استيراد ${res.data.imported} خدمة.` +
          (res.data.skipped.length
            ? ` تُخطّيت ${res.data.skipped.length}: ${res.data.skipped.slice(0, 3).join("، ")}`
            : ""),
      );
      router.refresh();
    } else {
      setError(
        res.fieldErrors ? Object.values(res.fieldErrors).join(" · ") : res.error,
      );
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {/* البحث والتصفية */}
      <form
        className="grid gap-3 sm:grid-cols-12"
        onSubmit={(e) => {
          e.preventDefault();
          load({ page: 1 });
        }}
      >
        <div className="sm:col-span-5">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم الخدمة أو رقمها..."
          />
        </div>
        <div className="sm:col-span-4">
          <select
            className={selectCls}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">كل التصنيفات</option>
            {data?.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 sm:col-span-3">
          <Button type="submit" variant="subtle" loading={loading} className="flex-1">
            <Search className="h-4 w-4" />
            بحث
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="تحديث الكتالوج"
            onClick={() => load({ page: 1, refresh: true })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {data && (
        <p className="text-xs text-muted">
          {data.total.toLocaleString("en")} خدمة مطابقة من أصل{" "}
          {data.totalAll.toLocaleString("en")} — المحدد:{" "}
          <span className="font-bold text-gold">{selected.size}</span>
        </p>
      )}

      {/* قائمة الخدمات للجوال (كروت تفاعلية) */}
      <div className="block space-y-2.5 sm:hidden">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/60 p-3 text-xs">
          <button
            type="button"
            className="flex items-center gap-2 font-medium"
            onClick={toggleAllOnPage}
          >
            {data && data.items.every((s) => selected.has(s.externalId)) ? (
              <CheckSquare className="h-4 w-4 text-gold" />
            ) : (
              <Square className="h-4 w-4 text-muted" />
            )}
            <span>تحديد الكل في هذه الصفحة</span>
          </button>
        </div>

        {loading && !data ? (
          <div className="rounded-lg border border-border p-6 text-center text-xs text-muted">
            جارٍ جلب كتالوج المزوّد…
          </div>
        ) : data?.items.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-xs text-muted">
            لا خدمات مطابقة.
          </div>
        ) : (
          data?.items.map((s) => {
            const isSel = selected.has(s.externalId);
            return (
              <div
                key={s.externalId}
                className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                  isSel ? "border-gold/50 bg-gold/5" : "border-border bg-surface hover:bg-surface-2/40"
                }`}
                onClick={() => toggle(s)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isSel ? (
                      <CheckSquare className="h-5 w-5 text-gold" />
                    ) : (
                      <Square className="h-5 w-5 text-muted" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug break-words">
                      {arabic.get(s.externalId) ?? s.name}
                    </p>
                    <p className="text-[11px] text-muted break-all" dir="ltr">
                      {s.name.slice(0, 80)}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px]">
                      <span className="text-muted" dir="ltr">
                        #{s.externalId} {s.category ? `· ${s.category}` : ""}
                      </span>
                      <span className="text-muted" dir="ltr">
                        الحد: {s.minQty ?? "—"} / {s.maxQty ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <span className="text-muted">المزوّد: <strong dir="ltr">{s.ratePer1000}$</strong></span>
                      <span className="font-bold text-gold">سعرك: <span dir="ltr">{previewPrice(s.ratePer1000)}$</span></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* قائمة الخدمات لأجهزة الكمبيوتر (جدول كامل) */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
              <th className="px-3 py-3">
                <button type="button" onClick={toggleAllOnPage} aria-label="تحديد الكل">
                  {data && data.items.every((s) => selected.has(s.externalId)) ? (
                    <CheckSquare className="h-4 w-4 text-gold" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-3 py-3 font-medium">الخدمة</th>
              <th className="px-3 py-3 font-medium">سعر المزوّد /1000</th>
              <th className="px-3 py-3 font-medium">سعرك بعد الهامش</th>
              <th className="px-3 py-3 font-medium">الحد الأدنى/الأقصى</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted">
                  جارٍ جلب كتالوج المزوّد… (قد يستغرق حتى دقيقة أول مرة)
                </td>
              </tr>
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted">
                  لا خدمات مطابقة.
                </td>
              </tr>
            ) : (
              data?.items.map((s) => {
                const isSel = selected.has(s.externalId);
                return (
                  <tr
                    key={s.externalId}
                    className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2/40 ${
                      isSel ? "bg-gold/5" : ""
                    }`}
                    onClick={() => toggle(s)}
                  >
                    <td className="px-3 py-3">
                      {isSel ? (
                        <CheckSquare className="h-4 w-4 text-gold" />
                      ) : (
                        <Square className="h-4 w-4 text-muted" />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">
                        {arabic.get(s.externalId) ?? s.name}
                      </p>
                      <p className="text-[11px] text-muted" dir="ltr">
                        {s.name.slice(0, 70)}
                      </p>
                      <p className="text-[11px] text-muted">
                        <span dir="ltr">#{s.externalId}</span>
                        {s.category ? ` · ${s.category}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3" dir="ltr">
                      {s.ratePer1000}$
                    </td>
                    <td className="px-3 py-3 font-semibold text-gold" dir="ltr">
                      {previewPrice(s.ratePer1000)}$
                    </td>
                    <td className="px-3 py-3 text-xs text-muted" dir="ltr">
                      {s.minQty ?? "—"} / {s.maxQty ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* الصفحات */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => load({ page: page - 1 })}
          >
            <ChevronRight className="h-4 w-4" />
            السابق
          </Button>
          <span className="text-xs text-muted">
            صفحة {page} من {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => load({ page: page + 1 })}
          >
            التالي
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* إعدادات الاستيراد */}
      <div className="grid gap-3 rounded-lg border border-gold/30 bg-gold/5 p-4 sm:grid-cols-12">
        <div className="sm:col-span-3">
          <Field label="نوع الهامش">
            <select
              className={selectCls}
              value={markupType}
              onChange={(e) => setMarkupType(e.target.value as "percent" | "fixed")}
            >
              <option value="percent">نسبة ٪</option>
              <option value="fixed">مبلغ ثابت $</option>
            </select>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={markupType === "percent" ? "النسبة ٪" : "المبلغ $"}>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={markupValue}
              onChange={(e) => setMarkupValue(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-4">
          <Field label="تصنيف المتجر">
            <select
              className={selectCls}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex items-end sm:col-span-3">
          <Button
            type="button"
            className="w-full"
            loading={importing}
            disabled={selected.size === 0 || !categoryId}
            onClick={runImport}
          >
            <Download className="h-4 w-4" />
            استيراد {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
        <label className="flex items-start sm:items-center gap-2 text-xs sm:col-span-12 leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="mt-0.5 sm:mt-0 h-4 w-4 shrink-0"
          />
          <span>نشر المنتجات فورًا (بدون تحديد تُستورد مخفية لمراجعتها أولًا)</span>
        </label>
        <p className="text-[11px] text-muted sm:col-span-12">
          <Badge tone="success">مزامنة تلقائية</Badge> سعرك يُعاد حسابه من سعر
          المزوّد + الهامش، فإن رفع المزوّد سعره ارتفع سعرك معه.
        </p>
      </div>
    </div>
  );
}
