"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiPost } from "@/lib/api-client";

type Cat = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isVisible: boolean;
};

async function apiSend<T>(
  url: string,
  method: "PUT" | "DELETE",
  body?: unknown,
): Promise<
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> }
> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!json) return { ok: false, error: "استجابة غير صالحة من الخادم." };
    return json;
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم." };
  }
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoryManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // إنشاء
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);

  // تعديل صف
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Cat | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await apiPost("/api/admin/categories", {
      name: newName,
      slug: newSlug || slugify(newName),
      sortOrder: categories.length,
      isVisible: true,
    });
    setCreating(false);
    if (res.ok) {
      setNewName("");
      setNewSlug("");
      router.refresh();
    } else {
      setError(res.fieldErrors ? Object.values(res.fieldErrors).join(" · ") : res.error);
    }
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    setError(null);
    const res = await apiSend(`/api/admin/categories/${edit.id}`, "PUT", {
      name: edit.name,
      slug: edit.slug,
      sortOrder: edit.sortOrder,
      isVisible: edit.isVisible,
    });
    setSaving(false);
    if (res.ok) {
      setEditId(null);
      setEdit(null);
      router.refresh();
    } else {
      setError(
        "fieldErrors" in res && res.fieldErrors
          ? Object.values(res.fieldErrors).join(" · ")
          : res.error,
      );
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    setError(null);
    const res = await apiSend(`/api/admin/categories/${id}`, "DELETE");
    setDeletingId(null);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <p className="mb-1 text-xs text-muted">اسم التصنيف</p>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
        </div>
        <div className="min-w-40 flex-1">
          <p className="mb-1 text-xs text-muted">المعرّف (اختياري)</p>
          <Input
            dir="ltr"
            value={newSlug}
            placeholder={slugify(newName) || "slug"}
            onChange={(e) => setNewSlug(e.target.value)}
          />
        </div>
        <Button type="submit" loading={creating}>
          <Plus className="h-4 w-4" />
          إضافة
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">المعرّف</th>
              <th className="px-4 py-3 font-medium">الترتيب</th>
              <th className="px-4 py-3 font-medium">الظهور</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted">
                  لا توجد تصنيفات بعد.
                </td>
              </tr>
            )}
            {categories.map((c) =>
              editId === c.id && edit ? (
                <tr key={c.id} className="border-b border-border/60 bg-surface-2/30 last:border-0">
                  <td className="px-4 py-2">
                    <Input
                      className="h-9"
                      value={edit.name}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      className="h-9"
                      dir="ltr"
                      value={edit.slug}
                      onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      className="h-9 w-20"
                      dir="ltr"
                      inputMode="numeric"
                      value={String(edit.sortOrder)}
                      onChange={(e) =>
                        setEdit({ ...edit, sortOrder: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={edit.isVisible}
                        onChange={(e) => setEdit({ ...edit, isVisible: e.target.checked })}
                      />
                      ظاهر
                    </label>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" loading={saving} onClick={saveEdit} aria-label="حفظ">
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => {
                          setEditId(null);
                          setEdit(null);
                        }}
                        aria-label="إلغاء"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted" dir="ltr">
                    {c.slug}
                  </td>
                  <td className="px-4 py-3 text-muted" dir="ltr">
                    {c.sortOrder}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={c.isVisible ? "success" : "neutral"}>
                      {c.isVisible ? "ظاهر" : "مخفي"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="تعديل"
                        onClick={() => {
                          setEditId(c.id);
                          setEdit(c);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="حذف"
                        loading={deletingId === c.id}
                        onClick={() => remove(c.id)}
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
