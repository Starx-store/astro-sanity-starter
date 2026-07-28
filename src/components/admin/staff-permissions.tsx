"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

/** أسماء عربية للصلاحيات الدقيقة. */
const LABELS: Record<string, string> = {
  "orders.manage": "إدارة الطلبات",
  "wallet.adjust": "تعديل أرصدة المحافظ",
  "products.edit": "إدارة المنتجات",
  "providers.manage": "إدارة المزوّدين",
  "users.manage": "إدارة المستخدمين",
  "deposits.review": "مراجعة الإيداعات",
  "support.manage": "إدارة الدعم",
  "settings.edit": "تعديل الإعدادات والكوبونات",
};

/** تحكّم الأدمن في دور الموظف وحدود ما يفعله. */
export function StaffPermissions({ userId }: { userId: string }) {
  const router = useRouter();
  const [role, setRole] = useState<"customer" | "staff">("customer");
  const [all, setAll] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/users/${userId}/staff`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) {
      setRole(j.data.role === "staff" ? "staff" : "customer");
      setAll(j.data.all);
      setSelected(new Set(j.data.permissions));
    } else if (j?.error) {
      setError(j.error);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(p: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function save() {
    setLoading(true);
    setError(null);
    setNotice(null);
    const res = await apiPost(`/api/admin/users/${userId}/staff`, {
      role,
      permissions: role === "staff" ? Array.from(selected) : [],
    });
    setLoading(false);
    if (res.ok) {
      setNotice("حُفظت الصلاحيات.");
      router.refresh();
      load();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRole("customer")}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
            role === "customer"
              ? "border-gold/50 bg-gold/15 text-gold"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          عميل
        </button>
        <button
          type="button"
          onClick={() => setRole("staff")}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
            role === "staff"
              ? "border-gold/50 bg-gold/15 text-gold"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          موظف
        </button>
      </div>

      {role === "staff" && (
        <div className="space-y-1 rounded-lg border border-border p-2">
          {all.map((p) => (
            <label
              key={p}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2/60"
            >
              <input
                type="checkbox"
                checked={selected.has(p)}
                onChange={() => toggle(p)}
              />
              <span>{LABELS[p] ?? p}</span>
            </label>
          ))}
          <p className="px-2 pt-1 text-[11px] text-muted">
            الموظف يرى لوحة الإدارة، لكنه لا يفعل إلا ما تُحدده هنا.
          </p>
        </div>
      )}

      <Button size="sm" className="w-full" loading={loading} onClick={save}>
        <Save className="h-4 w-4" />
        حفظ الصلاحيات
      </Button>
      <p className="flex items-start gap-1 text-[11px] text-muted">
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
        منح الصلاحيات متاح للأدمن فقط.
      </p>
    </div>
  );
}
