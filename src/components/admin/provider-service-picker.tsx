"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Service {
  externalId: string;
  name: string;
  category: string | null;
  ratePer1000: string;
  minQty: string | null;
  maxQty: string | null;
}

export function ProviderServicePicker({
  providerId,
  currentServiceId,
  onSelect,
}: {
  providerId: string;
  currentServiceId?: string | null;
  onSelect: (service: { externalId: string; name: string; ratePer1000: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = async (query = "") => {
    if (!providerId) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/admin/providers/${providerId}/services`, window.location.origin);
      if (query.trim()) url.searchParams.set("q", query.trim());
      url.searchParams.set("pageSize", "20");

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setServices(json.data.items ?? []);
      } else {
        setError(json?.error ?? "تعذّر جلب خدمات المزوّد.");
      }
    } catch {
      setError("حدث خطأ أثناء جلب قائمة الخدمات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && providerId) {
      search(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providerId]);

  if (!providerId) {
    return (
      <span className="text-xs text-muted">
        اختر المزوّد أولاً للبحث عن الخدمة
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full text-xs gap-1.5 h-9"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5 text-gold" />
        {currentServiceId ? `خدمة مختارة #${currentServiceId} (تغيير)` : "🔍 ابحث واختر الخدمة من المزوّد"}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-4 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base">البحث في خدمات المزوّد</h3>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                search(q);
              }}
              className="flex gap-2"
            >
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث باسم الخدمة أو رقمها (مثال: 4962 أو فيسبوك)..."
                className="flex-1"
                autoFocus
              />
              <Button type="submit" size="sm" loading={loading}>
                بحث
              </Button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-muted gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-gold" />
                  جارٍ جلب الخدمات...
                </div>
              ) : error ? (
                <p className="text-center text-xs text-danger py-8">{error}</p>
              ) : services.length === 0 ? (
                <p className="text-center text-xs text-muted py-8">لا توجد خدمات مطابقة.</p>
              ) : (
                services.map((s) => {
                  const isSelected = currentServiceId === s.externalId;
                  return (
                    <div
                      key={s.externalId}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors text-xs space-y-1 ${
                        isSelected
                          ? "border-gold bg-gold/10"
                          : "border-border bg-surface-2/40 hover:bg-surface-2"
                      }`}
                      onClick={() => {
                        onSelect({
                          externalId: s.externalId,
                          name: s.name,
                          ratePer1000: s.ratePer1000,
                        });
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-foreground leading-snug break-words">
                          {s.name}
                        </span>
                        {isSelected && (
                          <Badge tone="success" className="shrink-0 gap-1 text-[10px]">
                            <Check className="h-3 w-3" /> مٌختارة
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-border/30">
                        <span dir="ltr">رقم الخدمة: #{s.externalId}</span>
                        <span dir="ltr">السعر /1000: <strong className="text-gold">{s.ratePer1000}$</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
