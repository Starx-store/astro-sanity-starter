"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockManager } from "@/components/admin/stock-manager";
import { ProviderServicePicker } from "@/components/admin/provider-service-picker";
import { apiPost, apiPostForm, apiPut } from "@/lib/api-client";

/* أنواع بيانات النموذج (كلها نصوص/قيم بسيطة قابلة للتسلسل) */
type PkgRow = {
  id?: string;
  name: string;
  description: string;
  salePrice: string;
  traderPrice: string;
  costPrice: string;
  quantity?: string;
  ratePer1000?: string;
  packageType?: "fixed" | "quantity";
  pricePer1000?: string;
  traderPricePer1000?: string;
  minQty?: string;
  maxQty?: string;
  isAvailable: boolean;
  sortOrder: number;
  providerId: string | null;
  externalProductId: string | null;
  fallbackProviderId: string | null;
  fallbackExternalProductId: string | null;
};
type TierRow = { id?: string; minQty: string; maxQty: string; pricePerUnit: string };
type FieldRow = {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "email" | "number";
  required: boolean;
};
export type ProductFormInitial = {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  type: "package" | "quantity";
  fulfillment: "manual" | "automatic" | "stock";
  status: "active" | "hidden" | "maintenance" | "out_of_stock";
  traderOnly: boolean;
  imageId: string | null;
  description: string;
  executionTime: string;
  terms: string;
  warranty: string;
  sortOrder: number;
  requiredFields: FieldRow[];
  packages: PkgRow[];
  qtyConfig: {
    unit: string;
    minQty: string;
    maxQty: string;
    pricePerUnit: string;
    pricePer1000: string;
    traderPricePerUnit: string;
    traderPricePer1000: string;
    costPrice: string;
  };
  tiers: TierRow[];
};

const selectCls =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const areaCls =
  "w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm({
  initial,
  categories = [],
  providers = [],
  isNew,
}: {
  initial: ProductFormInitial;
  categories: { id: string; name: string }[];
  providers?: { id: string; name: string }[];
  isNew: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState<ProductFormInitial>(() => ({
    ...initial,
    packages: (initial.packages ?? []).map((p) => ({
      ...p,
      providerId: p.providerId ?? null,
      externalProductId: p.externalProductId ?? null,
      fallbackProviderId: p.fallbackProviderId ?? null,
      fallbackExternalProductId: p.fallbackExternalProductId ?? null,
    })),
    requiredFields: initial.requiredFields ?? [],
    tiers: initial.tiers ?? [],
    qtyConfig: initial.qtyConfig ?? {
      unit: "وحدة",
      minQty: "1",
      maxQty: "",
      pricePerUnit: "",
      pricePer1000: "",
      traderPricePerUnit: "",
      traderPricePer1000: "",
      costPrice: "0",
    },
  }));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  // معاينة الصورة الحالية عبر مسار المرفقات الخاص (جلسة الأدمن تخوّله).
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial.imageId ? `/api/files/${initial.imageId}` : null,
  );

  const set = <K extends keyof ProductFormInitial>(k: K, v: ProductFormInitial[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgError(null);
    if (file.size > 2 * 1024 * 1024) {
      setImgError("الحد الأقصى لحجم الصورة 2MB.");
      return;
    }
    setImgUploading(true);
    const form = new FormData();
    form.append("image", file);
    const res = await apiPostForm<{ id: string }>("/api/admin/products/image", form);
    setImgUploading(false);
    if (res.ok) {
      set("imageId", res.data.id);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setImgError(res.fieldErrors?.image ?? res.error);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    setSuccess(false);

    const payload = {
      name: f.name,
      slug: f.slug || slugify(f.name),
      categoryId: f.categoryId,
      type: f.type,
      fulfillment: f.fulfillment,
      status: f.status,
      traderOnly: f.traderOnly,
      imageId: f.imageId,
      description: f.description,
      executionTime: f.executionTime,
      terms: f.terms,
      warranty: f.warranty,
      sortOrder: f.sortOrder,
      requiredFields: f.requiredFields,
      packages: f.type === "package" ? f.packages : [],
      qtyConfig: f.type === "quantity" ? f.qtyConfig : undefined,
      tiers: f.type === "quantity" ? f.tiers : [],
    };

    const res = isNew
      ? await apiPost<{ id: string }>("/api/admin/products", payload)
      : await apiPut(`/api/admin/products/${f.id}`, payload).then((r) =>
          r.ok ? { ok: true as const, data: { id: f.id! } } : r,
        );

    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      if (isNew) {
        router.push(`/admin/products/${res.data.id}`);
      }
      router.refresh();
    } else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setFormError(res.error);
    }
  }

  const errorList = Object.values(errors);

  return (
    <form onSubmit={submit} className="space-y-6">
      {success && <Alert tone="success">تم الحفظ بنجاح.</Alert>}
      {formError && (
        <Alert tone="danger">
          {formError}
          {errorList.length > 0 && (
            <span className="mt-1 block text-xs">{errorList.join(" · ")}</span>
          )}
        </Alert>
      )}

      {/* الأساسيات */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">الأساسيات</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="صورة المنتج (اختياري)"
              error={imgError ?? errors.imageId}
              hint="تظهر في كروت المتجر وصفحة المنتج — JPG/PNG/WEBP حتى 2MB."
            >
              <div className="flex flex-wrap items-center gap-4">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="صورة المنتج"
                    className="h-24 w-40 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <span className="grid h-24 w-40 place-items-center rounded-lg border border-dashed border-border text-muted">
                    <ImageIcon className="h-8 w-8" />
                  </span>
                )}
                <div className="flex flex-col items-start gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onPickImage}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="subtle"
                    loading={imgUploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {f.imageId ? "تغيير الصورة" : "رفع صورة"}
                  </Button>
                  {f.imageId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        set("imageId", null);
                        setPreviewUrl(null);
                        setImgError(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                      إزالة الصورة
                    </Button>
                  )}
                </div>
              </div>
            </Field>
          </div>
          <Field label="اسم المنتج" error={errors.name}>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="المعرّف (slug)" error={errors.slug} hint="يظهر في الرابط — اتركه فارغًا للتوليد من الاسم">
            <Input
              value={f.slug}
              dir="ltr"
              onChange={(e) => set("slug", e.target.value)}
              placeholder={slugify(f.name) || "my-product"}
            />
          </Field>
          <Field label="التصنيف" error={errors.categoryId}>
            <select
              className={selectCls}
              value={f.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
            >
              <option value="">— اختر —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الحالة">
            <select
              className={selectCls}
              value={f.status}
              onChange={(e) => set("status", e.target.value as ProductFormInitial["status"])}
            >
              <option value="active">متاح</option>
              <option value="hidden">مخفي</option>
              <option value="maintenance">صيانة</option>
              <option value="out_of_stock">نفدت الكمية</option>
            </select>
          </Field>
          <Field label="الظهور">
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3">
              <input
                type="checkbox"
                checked={f.traderOnly}
                onChange={(e) => set("traderOnly", e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">للتجار فقط</span>
            </label>
          </Field>
          <Field label="نوع المنتج" hint={isNew ? undefined : "لا يتغيّر بعد الإنشاء"}>
            <select
              className={selectCls}
              value={f.type}
              disabled={!isNew}
              onChange={(e) => set("type", e.target.value as ProductFormInitial["type"])}
            >
              <option value="package">بكجات</option>
              <option value="quantity">كمية</option>
            </select>
          </Field>
          <Field
            label="طريقة التنفيذ"
            hint={
              f.fulfillment === "automatic"
                ? "يتطلب ربط المنتج بمزوّد نشط من صفحة المزوّدين"
                : f.fulfillment === "stock"
                  ? "تسليم فوري من مخزون أكواد/حسابات تضيفها أدناه بعد الحفظ"
                  : undefined
            }
          >
            <select
              className={selectCls}
              value={f.fulfillment}
              onChange={(e) =>
                set(
                  "fulfillment",
                  e.target.value as ProductFormInitial["fulfillment"],
                )
              }
            >
              <option value="manual">يدوي</option>
              <option value="automatic">تلقائي (عبر مزوّد)</option>
              <option value="stock">مخزون — تسليم فوري</option>
            </select>
          </Field>
          <Field label="مدة التنفيذ المتوقعة">
            <Input
              value={f.executionTime}
              onChange={(e) => set("executionTime", e.target.value)}
              placeholder="مثال: 1-24 ساعة"
            />
          </Field>
          <Field label="ترتيب العرض">
            <Input
              dir="ltr"
              inputMode="numeric"
              value={String(f.sortOrder)}
              onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="الوصف">
              <textarea
                className={areaCls}
                rows={3}
                value={f.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="الشروط والتنبيهات">
              <textarea
                className={areaCls}
                rows={2}
                value={f.terms}
                onChange={(e) => set("terms", e.target.value)}
              />
            </Field>
          </div>
          <Field label="الضمان (اختياري)">
            <Input value={f.warranty} onChange={(e) => set("warranty", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* البكجات */}
      {f.type === "package" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">البكجات</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="subtle"
              onClick={() =>
                set("packages", [
                  ...f.packages,
                  {
                    name: "",
                    description: "",
                    salePrice: "",
                    traderPrice: "",
                    costPrice: "0",
                    quantity: "1000",
                    isAvailable: true,
                    sortOrder: f.packages.length,
                    providerId: null,
                    externalProductId: null,
                    fallbackProviderId: null,
                    fallbackExternalProductId: null,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              بكج
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.packages && (
              <p className="text-xs font-medium text-danger">{errors.packages}</p>
            )}
            {f.packages.map((p, i) => (
              <div
                key={p.id ?? `new-${i}`}
                className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-4 sm:grid-cols-12"
              >
                <div className="sm:col-span-3">
                  <Field label="نوع البكج الفرعي">
                    <select
                      className={selectCls}
                      value={p.packageType ?? "fixed"}
                      onChange={(e) => {
                        const pType = e.target.value as "fixed" | "quantity";
                        set(
                          "packages",
                          f.packages.map((x, j) =>
                            j === i ? { ...x, packageType: pType } : x,
                          ),
                        );
                      }}
                    >
                      <option value="fixed">فردي / ثابت (اشتراك / كمية محددة)</option>
                      <option value="quantity">حسب الكمية (العميل يكتب الكمية بنفسه)</option>
                    </select>
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="الاسم">
                    <Input
                      value={p.name}
                      onChange={(e) =>
                        set(
                          "packages",
                          f.packages.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>

                {p.packageType === "quantity" ? (
                  <>
                    <div className="sm:col-span-3">
                      <Field label="سعر كل 1000 للزبون $">
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          placeholder="مثال: 2.50"
                          value={p.pricePer1000 ?? p.salePrice ?? ""}
                          onChange={(e) =>
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i
                                  ? { ...x, pricePer1000: e.target.value, salePrice: e.target.value || "0" }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="سعر كل 1000 للتاجر $">
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          placeholder="مثال: 1.80 (اختياري)"
                          value={p.traderPricePer1000 ?? p.traderPrice ?? ""}
                          onChange={(e) =>
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i
                                  ? { ...x, traderPricePer1000: e.target.value, traderPrice: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="سعر الـ 1000 للمزوّد $">
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          placeholder="مثال: 1.40"
                          value={p.ratePer1000 ?? p.costPrice ?? ""}
                          onChange={(e) =>
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i
                                  ? { ...x, ratePer1000: e.target.value, costPrice: e.target.value || "0" }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="أدنى كمية للزبون">
                        <Input
                          dir="ltr"
                          inputMode="numeric"
                          placeholder="مثال: 100"
                          value={p.minQty ?? "1"}
                          onChange={(e) =>
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i ? { ...x, minQty: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="أقصى كمية للزبون">
                        <Input
                          dir="ltr"
                          inputMode="numeric"
                          placeholder="مثال: 50000 (اختياري)"
                          value={p.maxQty ?? ""}
                          onChange={(e) =>
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i ? { ...x, maxQty: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sm:col-span-3">
                      <Field label="سعر البيع للزبون $">
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          value={p.salePrice ?? ""}
                          onChange={(e) =>
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i ? { ...x, salePrice: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="سعر التاجر $">
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          placeholder="اختياري"
                          value={p.traderPrice ?? ""}
                          onChange={(e) =>
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i ? { ...x, traderPrice: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="الكمية للمزوّد">
                        <Input
                          dir="ltr"
                          inputMode="numeric"
                          placeholder="مثال: 1000"
                          value={p.quantity ?? "1000"}
                          onChange={(e) => {
                            const newQty = e.target.value;
                            const rNum = Number(p.ratePer1000) || 0;
                            const qNum = Number(newQty) || 0;
                            const calcCost = rNum > 0 && qNum > 0 ? ((rNum * qNum) / 1000).toFixed(4) : (p.costPrice || "0");
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i ? { ...x, quantity: newQty, costPrice: calcCost } : x,
                              ),
                            );
                          }}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="سعر الـ 1000 للمزوّد $">
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          placeholder="مثال: 0.0014"
                          value={p.ratePer1000 ?? ""}
                          onChange={(e) => {
                            const newRate = e.target.value;
                            const rNum = Number(newRate) || 0;
                            const qNum = Number(p.quantity || "1000") || 0;
                            const calcCost = rNum > 0 && qNum > 0 ? ((rNum * qNum) / 1000).toFixed(4) : (p.costPrice || "0");
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i ? { ...x, ratePer1000: newRate, costPrice: calcCost } : x,
                              ),
                            );
                          }}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-3">
                      <Field label="التكلفة الإجمالية عليك $">
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          placeholder="مثال: 1.40"
                          value={p.costPrice ?? "0"}
                          onChange={(e) =>
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i ? { ...x, costPrice: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                  </>
                )}
                <div className="flex items-end gap-2 sm:col-span-2">
                  <label className="flex h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={p.isAvailable}
                      onChange={(e) =>
                        set(
                          "packages",
                          f.packages.map((x, j) =>
                            j === i ? { ...x, isAvailable: e.target.checked } : x,
                          ),
                        )
                      }
                    />
                    متاح
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="حذف البكج"
                    onClick={() =>
                      set(
                        "packages",
                        f.packages.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
                <div className="sm:col-span-12">
                  <Field label="وصف مختصر (اختياري)">
                    <Input
                      value={p.description}
                      onChange={(e) =>
                        set(
                          "packages",
                          f.packages.map((x, j) =>
                            j === i ? { ...x, description: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <div className="sm:col-span-12 grid grid-cols-1 sm:grid-cols-4 gap-3 mt-2 pt-3 border-t border-border/50">
                  <Field label="المزوّد الأساسي (اختياري)">
                    <select
                      className={selectCls}
                      value={p.providerId ?? ""}
                      onChange={(e) =>
                        set(
                          "packages",
                          f.packages.map((x, j) =>
                            j === i ? { ...x, providerId: e.target.value || null } : x,
                          ),
                        )
                      }
                    >
                      <option value="">— لا يوجد —</option>
                      {providers?.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="رقم الخدمة الخارجي">
                    <div className="space-y-1.5">
                      <Input
                        dir="ltr"
                        value={p.externalProductId ?? ""}
                        onChange={(e) =>
                          set(
                            "packages",
                            f.packages.map((x, j) =>
                              j === i ? { ...x, externalProductId: e.target.value || null } : x,
                            ),
                          )
                        }
                        placeholder="رقم الخدمة (مثال: 4962)"
                      />
                      {p.providerId && (
                        <ProviderServicePicker
                          providerId={p.providerId}
                          currentServiceId={p.externalProductId}
                          onSelect={(svc) => {
                            const pkgQty = Number(p.quantity || "1") || 1;
                            const rate1000 = Number(svc.ratePer1000) || 0;
                            const calcCost = rate1000 > 0 ? ((rate1000 * pkgQty) / 1000).toFixed(4) : svc.ratePer1000;
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      externalProductId: svc.externalId,
                                      ratePer1000: svc.ratePer1000,
                                      costPrice: calcCost || "0",
                                    }
                                  : x,
                              ),
                            );
                          }}
                        />
                      )}
                    </div>
                  </Field>
                  <Field label="المزوّد الاحتياطي (اختياري)">
                    <select
                      className={selectCls}
                      value={p.fallbackProviderId ?? ""}
                      onChange={(e) =>
                        set(
                          "packages",
                          f.packages.map((x, j) =>
                            j === i ? { ...x, fallbackProviderId: e.target.value || null } : x,
                          ),
                        )
                      }
                    >
                      <option value="">— لا يوجد —</option>
                      {providers?.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="رقم الخدمة الاحتياطي">
                    <div className="space-y-1.5">
                      <Input
                        dir="ltr"
                        value={p.fallbackExternalProductId ?? ""}
                        onChange={(e) =>
                          set(
                            "packages",
                            f.packages.map((x, j) =>
                              j === i ? { ...x, fallbackExternalProductId: e.target.value || null } : x,
                            ),
                          )
                        }
                        placeholder="رقم الخدمة الاحتياطي"
                      />
                      {p.fallbackProviderId && (
                        <ProviderServicePicker
                          providerId={p.fallbackProviderId}
                          currentServiceId={p.fallbackExternalProductId}
                          onSelect={(svc) => {
                            set(
                              "packages",
                              f.packages.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      fallbackExternalProductId: svc.externalId,
                                    }
                                  : x,
                              ),
                            );
                          }}
                        />
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* مخزون التسليم الفوري — بعد حفظ المنتج */}
      {f.fulfillment === "stock" &&
        (isNew || !f.id ? (
          <Alert tone="warning">
            احفظ المنتج أولًا ثم عُد لإضافة أكواد/حسابات المخزون هنا.
          </Alert>
        ) : (
          <StockManager
            productId={f.id}
            packages={
              f.type === "package"
                ? f.packages
                    .filter((p): p is PkgRow & { id: string } => !!p.id)
                    .map((p) => ({ id: p.id, name: p.name }))
                : []
            }
          />
        ))}

      {/* إعدادات الكمية */}
      {f.type === "quantity" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">إعدادات الكمية والتسعير</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {errors.qtyConfig && (
                <p className="text-xs font-medium text-danger sm:col-span-3">
                  {errors.qtyConfig}
                </p>
              )}
              <Field label="الوحدة">
                <Input
                  value={f.qtyConfig.unit}
                  onChange={(e) => set("qtyConfig", { ...f.qtyConfig, unit: e.target.value })}
                  placeholder="متابع / نقطة / ألف"
                />
              </Field>
              <Field label="أدنى كمية">
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  value={f.qtyConfig.minQty}
                  onChange={(e) => set("qtyConfig", { ...f.qtyConfig, minQty: e.target.value })}
                />
              </Field>
              <Field label="أقصى كمية (اختياري)">
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  value={f.qtyConfig.maxQty}
                  onChange={(e) => set("qtyConfig", { ...f.qtyConfig, maxQty: e.target.value })}
                />
              </Field>
              <Field label="سعر الوحدة $ (اختياري)">
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  value={f.qtyConfig.pricePerUnit}
                  onChange={(e) =>
                    set("qtyConfig", { ...f.qtyConfig, pricePerUnit: e.target.value })
                  }
                />
              </Field>
              <Field label="سعر كل 1000 $ (اختياري)">
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  value={f.qtyConfig.pricePer1000}
                  onChange={(e) =>
                    set("qtyConfig", { ...f.qtyConfig, pricePer1000: e.target.value })
                  }
                />
              </Field>
              <Field label="سعر الوحدة للتاجر $ (اختياري)">
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  value={f.qtyConfig.traderPricePerUnit}
                  onChange={(e) =>
                    set("qtyConfig", {
                      ...f.qtyConfig,
                      traderPricePerUnit: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="سعر كل 1000 للتاجر $ (اختياري)">
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  value={f.qtyConfig.traderPricePer1000}
                  onChange={(e) =>
                    set("qtyConfig", {
                      ...f.qtyConfig,
                      traderPricePer1000: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="تكلفة الوحدة $">
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  value={f.qtyConfig.costPrice}
                  onChange={(e) =>
                    set("qtyConfig", { ...f.qtyConfig, costPrice: e.target.value })
                  }
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">
                شرائح الأسعار <span className="text-xs font-normal text-muted">(اختياري — تتجاوز سعر الوحدة)</span>
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="subtle"
                onClick={() =>
                  set("tiers", [...f.tiers, { minQty: "", maxQty: "", pricePerUnit: "" }])
                }
              >
                <Plus className="h-4 w-4" />
                شريحة
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {f.tiers.map((t, i) => (
                <div
                  key={t.id ?? `new-${i}`}
                  className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-4 sm:grid-cols-10"
                >
                  <div className="sm:col-span-3">
                    <Field label="من كمية">
                      <Input
                        dir="ltr"
                        inputMode="decimal"
                        value={t.minQty}
                        onChange={(e) =>
                          set(
                            "tiers",
                            f.tiers.map((x, j) =>
                              j === i ? { ...x, minQty: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-3">
                    <Field label="إلى كمية (اختياري)">
                      <Input
                        dir="ltr"
                        inputMode="decimal"
                        value={t.maxQty}
                        onChange={(e) =>
                          set(
                            "tiers",
                            f.tiers.map((x, j) =>
                              j === i ? { ...x, maxQty: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-3">
                    <Field label="سعر الوحدة $">
                      <Input
                        dir="ltr"
                        inputMode="decimal"
                        value={t.pricePerUnit}
                        onChange={(e) =>
                          set(
                            "tiers",
                            f.tiers.map((x, j) =>
                              j === i ? { ...x, pricePerUnit: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex items-end sm:col-span-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="حذف الشريحة"
                      onClick={() => set("tiers", f.tiers.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* الحقول المطلوبة من العميل */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            بيانات مطلوبة من العميل{" "}
            <span className="text-xs font-normal text-muted">(مثل رابط الحساب)</span>
          </CardTitle>
          <Button
            type="button"
            size="sm"
            variant="subtle"
            onClick={() =>
              set("requiredFields", [
                ...f.requiredFields,
                { key: `field_${f.requiredFields.length + 1}`, label: "", type: "text", required: true },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            حقل
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.requiredFields && (
            <p className="text-xs font-medium text-danger">{errors.requiredFields}</p>
          )}
          {f.requiredFields.map((r, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-4 sm:grid-cols-10"
            >
              <div className="sm:col-span-3">
                <Field label="التسمية (تظهر للعميل)">
                  <Input
                    value={r.label}
                    onChange={(e) =>
                      set(
                        "requiredFields",
                        f.requiredFields.map((x, j) =>
                          j === i ? { ...x, label: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="المفتاح (لاتيني)">
                  <Input
                    dir="ltr"
                    value={r.key}
                    onChange={(e) =>
                      set(
                        "requiredFields",
                        f.requiredFields.map((x, j) =>
                          j === i ? { ...x, key: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="النوع">
                  <select
                    className={selectCls}
                    value={r.type}
                    onChange={(e) =>
                      set(
                        "requiredFields",
                        f.requiredFields.map((x, j) =>
                          j === i ? { ...x, type: e.target.value as FieldRow["type"] } : x,
                        ),
                      )
                    }
                  >
                    <option value="text">نص</option>
                    <option value="textarea">نص طويل</option>
                    <option value="url">رابط</option>
                    <option value="email">بريد</option>
                    <option value="number">رقم</option>
                  </select>
                </Field>
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <label className="flex h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.required}
                    onChange={(e) =>
                      set(
                        "requiredFields",
                        f.requiredFields.map((x, j) =>
                          j === i ? { ...x, required: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  إلزامي
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="حذف الحقل"
                  onClick={() =>
                    set(
                      "requiredFields",
                      f.requiredFields.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={loading}>
          <Save className="h-5 w-5" />
          {isNew ? "إنشاء المنتج" : "حفظ التغييرات"}
        </Button>
      </div>
    </form>
  );
}
