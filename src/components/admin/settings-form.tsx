"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";

export function SettingsForm({
  initial,
}: {
  initial: {
    storeName: string;
    currency: string;
    minDeposit: string;
    maintenance: boolean;
    silverDiscount: string;
    goldDiscount: string;
    sarRate: string;
    yersRate: string;
    yeroRate: string;
    bep20Address: string;
    cryptoMinConfirmations: string;
    supportWhatsapp: string;
    logo: string;
    traderReferralCode: string;
    "store.whatsapp": string;
    "store.meta_description": string;
    "announcement.enabled": boolean;
    "announcement.text_ar": string;
    "announcement.text_en": string;
    "announcement.link": string;
    "announcement.badge": string;
  };
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(
    null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setMsg(null);
    const res = await apiPost("/api/admin/settings", f);
    setLoading(false);
    if (res.ok) {
      setMsg({ tone: "success", text: "تم حفظ الإعدادات." });
      router.refresh();
    } else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setMsg({ tone: "danger", text: res.error });
    }
  }

  return (
    <>
    <form onSubmit={submit} className="space-y-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم المتجر" error={errors.storeName}>
          <Input value={f.storeName} onChange={(e) => setF({ ...f, storeName: e.target.value })} />
        </Field>
        <Field label="العملة" error={errors.currency}>
          <Input dir="ltr" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} />
        </Field>
        <Field label="الحد الأدنى للشحن" error={errors.minDeposit}>
          <Input
            dir="ltr"
            inputMode="decimal"
            value={f.minDeposit}
            onChange={(e) => setF({ ...f, minDeposit: e.target.value })}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-4">
        <input
          type="checkbox"
          checked={f.maintenance}
          onChange={(e) => setF({ ...f, maintenance: e.target.checked })}
          className="h-4 w-4"
        />
        <span>
          <span className="block text-sm font-medium">وضع الصيانة</span>
          <span className="block text-xs text-muted">
            عند التفعيل يُمنع العملاء من التصفّح (الإدارة تبقى تعمل).
          </span>
        </span>
      </label>

      <div className="rounded-lg border border-border bg-surface-2/40 p-4">
        <p className="mb-1 text-sm font-medium">خصومات باقات العضوية (٪)</p>
        <p className="mb-3 text-xs text-muted">
          يُرقّى العميل تلقائيًا حسب إنفاقه: فضية عند تجاوز 100$، ذهبية عند تجاوز
          500$. تُطبّق النسبة تلقائيًا على أسعار طلباته.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="خصم الباقة الفضية ٪" error={errors.silverDiscount}>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={f.silverDiscount}
              onChange={(e) => setF({ ...f, silverDiscount: e.target.value })}
            />
          </Field>
          <Field label="خصم الباقة الذهبية ٪" error={errors.goldDiscount}>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={f.goldDiscount}
              onChange={(e) => setF({ ...f, goldDiscount: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-2/40 p-4">
        <p className="mb-1 text-sm font-medium">عملات العرض (سعر الصرف مقابل 1$)</p>
        <p className="mb-3 text-xs text-muted">
          العميل يبدّل عملة العرض من أعلى المتجر — الأسعار تُعرض محوّلة
          تقريبيًا، والدفع الفعلي يبقى بالدولار من المحفظة. ضع 0 لتعطيل عملة.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="ريال سعودي" error={errors.sarRate}>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={f.sarRate}
              onChange={(e) => setF({ ...f, sarRate: e.target.value })}
            />
          </Field>
          <Field label="ريال يمني (جنوبي)" error={errors.yersRate}>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={f.yersRate}
              onChange={(e) => setF({ ...f, yersRate: e.target.value })}
            />
          </Field>
          <Field label="ريال يمني (قديم)" error={errors.yeroRate}>
            <Input
              dir="ltr"
              inputMode="decimal"
              value={f.yeroRate}
              onChange={(e) => setF({ ...f, yeroRate: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-2/40 p-4">
        <p className="mb-1 text-sm font-medium">
          الشحن بالعملات الرقمية (BEP20)
        </p>
        <p className="mb-3 text-xs text-muted">
          ضع عنوان محفظتك على شبكة BNB Smart Chain — يتحقق الموقع من التحويلات
          مباشرة من البلوكتشين ويشحن رصيد العميل تلقائيًا (USDT / USDC / BUSD).
          اتركه فارغًا لتعطيل الميزة.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="عنوان المحفظة (BEP20)" error={errors.bep20Address}>
              <Input
                dir="ltr"
                placeholder="0x..."
                value={f.bep20Address}
                onChange={(e) => setF({ ...f, bep20Address: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label="أدنى تأكيدات"
            error={errors.cryptoMinConfirmations}
          >
            <Input
              dir="ltr"
              inputMode="numeric"
              value={f.cryptoMinConfirmations}
              onChange={(e) =>
                setF({ ...f, cryptoMinConfirmations: e.target.value })
              }
            />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-2/40 p-4">
        <p className="mb-1 text-sm font-medium">شعار المتجر</p>
        <p className="mb-3 text-xs text-muted">
          ارفع شعارك (PNG / JPG / WebP / SVG حتى 300KB) — يظهر أعلى المتجر
          وفي كل الصفحات بدل الشعار الافتراضي.
        </p>
        <div className="flex items-center gap-4">
          {f.logo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={f.logo}
              alt="شعار المتجر"
              className="h-14 w-14 rounded-lg border border-border object-contain"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-lg border border-dashed border-border text-xs text-muted">
              بلا
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 300 * 1024) {
                  setErrors((p) => ({
                    ...p,
                    logo: "الملف أكبر من 300KB — صغّر الصورة",
                  }));
                  return;
                }
                setErrors(({ logo: _l, ...rest }) => rest);
                const reader = new FileReader();
                reader.onload = () =>
                  setF((prev) => ({ ...prev, logo: String(reader.result) }));
                reader.readAsDataURL(file);
              }}
            />
            {f.logo && (
              <button
                type="button"
                className="self-start text-xs text-danger hover:underline"
                onClick={() => setF((prev) => ({ ...prev, logo: "" }))}
              >
                إزالة الشعار (رجوع للافتراضي)
              </button>
            )}
            {errors.logo && (
              <span className="text-xs text-danger">{errors.logo}</span>
            )}
          </div>
        </div>
      </div>

      <Field
        label="رقم واتساب الدعم"
        error={errors.supportWhatsapp}
        hint="أرقام فقط مع رمز الدولة (مثال 967771581353) — يظهر كزر عائم في المتجر."
      >
        <Input
          dir="ltr"
          inputMode="numeric"
          value={f.supportWhatsapp}
          onChange={(e) => setF({ ...f, supportWhatsapp: e.target.value })}
        />
      </Field>

      <Field
        label="كود إحالة التاجر"
        error={errors.traderReferralCode}
        hint="المستخدمون الذين يسجلون بهذا الكود يحصلون على باقة التاجر مباشرة."
      >
        <Input
          dir="ltr"
          value={f.traderReferralCode}
          onChange={(e) => setF({ ...f, traderReferralCode: e.target.value })}
        />
      </Field>

      <div className="rounded-lg border border-border bg-surface-2/40 p-4 space-y-4">
        <p className="mb-1 text-sm font-medium">الشريط الإعلاني (Announcement Bar)</p>
        
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={f["announcement.enabled"]}
            onChange={(e) => setF({ ...f, "announcement.enabled": e.target.checked })}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium">تفعيل الشريط الإعلاني</span>
        </label>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="النص بالعربية" error={errors["announcement.text_ar"]}>
            <Input value={f["announcement.text_ar"]} onChange={(e) => setF({ ...f, "announcement.text_ar": e.target.value })} />
          </Field>
          <Field label="النص بالإنجليزية" error={errors["announcement.text_en"]}>
            <Input value={f["announcement.text_en"]} onChange={(e) => setF({ ...f, "announcement.text_en": e.target.value })} />
          </Field>
          <Field label="رابط (اختياري)" error={errors["announcement.link"]}>
            <Input dir="ltr" value={f["announcement.link"]} onChange={(e) => setF({ ...f, "announcement.link": e.target.value })} />
          </Field>
          <Field label="شريط مميز (Badge)" error={errors["announcement.badge"]} hint="مثال: NEW, حصري">
            <Input value={f["announcement.badge"]} onChange={(e) => setF({ ...f, "announcement.badge": e.target.value })} />
          </Field>
        </div>
      </div>
      
      <div className="rounded-lg border border-border bg-surface-2/40 p-4 space-y-4">
        <p className="mb-1 text-sm font-medium">التحكم في التسجيل والوصول (Registration & Access)</p>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={f["auth.register_phone_required"]}
              onChange={(e) => setF({ ...f, "auth.register_phone_required": e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">إجبارية رقم الواتساب عند التسجيل</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={f["auth.allow_registration"]}
              onChange={(e) => setF({ ...f, "auth.allow_registration": e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">السماح بتسجيل حسابات جديدة بالمتجر</span>
          </label>
        </div>

        <Field
          label="البريد الإلكتروني الاحتياطي لاستعادة الوصول (Recovery Email)"
          error={errors["admin.fallback_email"]}
          hint="إيميلك الشخصي الاحتياطي لاستلام تنبيهات الأمان واستعادة الحساب في الحالات الطارئة."
        >
          <Input
            dir="ltr"
            type="email"
            placeholder="your-personal-email@example.com"
            value={f["admin.fallback_email"]}
            onChange={(e) => setF({ ...f, "admin.fallback_email": e.target.value })}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-surface-2/40 p-4 space-y-4">
        <p className="mb-1 text-sm font-medium">SEO & Social</p>
        
        <Field label="وصف المتجر (Meta Description)" error={errors["store.meta_description"]}>
          <textarea
            className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
            value={f["store.meta_description"]}
            onChange={(e) => setF({ ...f, "store.meta_description": e.target.value })}
          />
        </Field>
      </div>

      <Button type="submit" loading={loading}>
        <Save className="h-4 w-4" />
        حفظ الإعدادات
      </Button>
    </form>

    <ChangePasswordForm />
    </>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErrors({});

    const res = await apiPost("/api/admin/change-password", {
      currentPassword,
      newPassword,
      confirmNewPassword,
    });

    setLoading(false);
    if (res.ok) {
      setMsg({ tone: "success", text: "تم تغيير كلمة المرور بنجاح!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setMsg({ tone: "danger", text: res.error || "فشل تغيير كلمة المرور" });
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-border bg-surface/50 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold">تغيير كلمة مرور الأدمن</h2>
        <p className="text-xs text-muted">قم بتغيير كلمة المرور الخاصة بحسابك للأمان.</p>
      </div>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="كلمة المرور الحالية" error={errors.currentPassword}>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="كلمة المرور الجديدة" error={errors.newPassword}>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </Field>

          <Field label="تأكيد كلمة المرور الجديدة" error={errors.confirmNewPassword}>
            <Input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
            />
          </Field>
        </div>

        <Button type="submit" loading={loading}>
          تحديث كلمة المرور
        </Button>
      </form>
    </div>
  );
}

