"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPost } from "@/lib/api-client";

type AdapterMeta = {
  key: string;
  label: string;
  credentialFields: { key: string; label: string }[];
};

export type ProviderFormInitial = {
  id?: string;
  name: string;
  baseUrl: string;
  adapter: string;
  markupType: "fixed" | "percent";
  markupValue: string;
  status: "active" | "paused";
  linkField: string;
};

const selectCls =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

async function apiPut(url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => null)) ?? { ok: false, error: "استجابة غير صالحة." };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم." };
  }
}

export function ProviderForm({
  initial,
  adapters,
  isNew,
}: {
  initial: ProviderFormInitial;
  adapters: AdapterMeta[];
  isNew: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const activeAdapter = adapters.find((a) => a.key === f.adapter);
  const isSmm = f.adapter === "smm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    setSuccess(false);

    const payload = {
      name: f.name,
      baseUrl: f.baseUrl,
      adapter: f.adapter,
      markupType: f.markupType,
      markupValue: f.markupValue || "0",
      status: f.status,
      credentials: creds,
      config: isSmm ? { linkField: f.linkField || "link" } : {},
    };

    const res = isNew
      ? await apiPost<{ id: string }>("/api/admin/providers", payload)
      : await apiPut(`/api/admin/providers/${f.id}`, payload);

    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      if (isNew && "data" in res && res.data) {
        router.push(`/admin/providers/${(res.data as { id: string }).id}`);
      }
      router.refresh();
    } else {
      if ("fieldErrors" in res && res.fieldErrors) {
        setErrors(res.fieldErrors as Record<string, string>);
      }
      setFormError((res as { error?: string }).error ?? "تعذّر الحفظ.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {success && <Alert tone="success">تم الحفظ بنجاح.</Alert>}
      {formError && <Alert tone="danger">{formError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">بيانات المزوّد</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم" error={errors.name}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="نوع المحوّل" error={errors.adapter}>
            <select
              className={selectCls}
              value={f.adapter}
              onChange={(e) => setF({ ...f, adapter: e.target.value })}
            >
              {adapters.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="رابط الـ API (baseUrl)"
              error={errors.baseUrl}
              hint={isSmm ? "مثال: https://panel.example.com/api/v2" : undefined}
            >
              <Input
                dir="ltr"
                value={f.baseUrl}
                onChange={(e) => setF({ ...f, baseUrl: e.target.value })}
                placeholder="https://..."
              />
            </Field>
          </div>
          <Field label="نوع الهامش">
            <select
              className={selectCls}
              value={f.markupType}
              onChange={(e) =>
                setF({ ...f, markupType: e.target.value as "fixed" | "percent" })
              }
            >
              <option value="percent">نسبة مئوية %</option>
              <option value="fixed">مبلغ ثابت $</option>
            </select>
          </Field>
          <Field label="قيمة الهامش" error={errors.markupValue}>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={f.markupValue}
              onChange={(e) => setF({ ...f, markupValue: e.target.value })}
            />
          </Field>
          <Field label="الحالة">
            <select
              className={selectCls}
              value={f.status}
              onChange={(e) =>
                setF({ ...f, status: e.target.value as "active" | "paused" })
              }
            >
              <option value="active">نشط</option>
              <option value="paused">موقوف</option>
            </select>
          </Field>
          {isSmm && (
            <Field
              label="حقل الرابط في بيانات الطلب"
              hint="مفتاح الحقل المطلوب من العميل الذي يُرسل كـ link"
            >
              <Input
                dir="ltr"
                value={f.linkField}
                onChange={(e) => setF({ ...f, linkField: e.target.value })}
                placeholder="link"
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {activeAdapter && activeAdapter.credentialFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              الأسرار (API) 🔒{" "}
              {!isNew && (
                <span className="text-xs font-normal text-muted">
                  — اتركها فارغة للإبقاء على القيم الحالية
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {activeAdapter.credentialFields.map((cf) => (
              <Field key={cf.key} label={cf.label}>
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  value={creds[cf.key] ?? ""}
                  onChange={(e) =>
                    setCreds((s) => ({ ...s, [cf.key]: e.target.value }))
                  }
                  placeholder={isNew ? "" : "••••••••"}
                />
              </Field>
            ))}
            <p className="text-xs text-muted sm:col-span-2">
              الأسرار تُشفّر at-rest ولا تظهر للواجهة إطلاقًا.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={loading}>
          <Save className="h-5 w-5" />
          {isNew ? "إضافة المزوّد" : "حفظ التغييرات"}
        </Button>
      </div>
    </form>
  );
}
