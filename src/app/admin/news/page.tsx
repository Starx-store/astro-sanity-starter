"use client";

import { useEffect, useState } from "react";
import {
  Newspaper,
  Plus,
  Pin,
  Trash2,
  Edit,
  Lightbulb,
  Bell,
  Check,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: "update" | "tip" | "news";
  imageUrl?: string | null;
  isPinned: boolean;
  publishedAt: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, { label: string; tone: "gold" | "info" | "success"; icon: any }> = {
  update: { label: "تحديث جديد", tone: "info", icon: Bell },
  tip: { label: "نصيحة يومية", tone: "gold", icon: Lightbulb },
  news: { label: "خبر عام", tone: "success", icon: Newspaper },
};

export default function AdminNewsPage() {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Form modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<"update" | "tip" | "news">("news");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadArticles() {
    setLoading(true);
    setError(null);
    const res = await apiGet<{ articles: NewsItem[] }>("/api/admin/news");
    if (res.ok) {
      setArticles(res.data.articles);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadArticles();
  }, []);

  function openCreate() {
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
    setFormCategory("news");
    setFormImageUrl("");
    setFormIsPinned(false);
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(item: NewsItem) {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormCategory(item.category);
    setFormImageUrl(item.imageUrl || "");
    setFormIsPinned(item.isPinned);
    setFormError(null);
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!formTitle.trim() || !formContent.trim()) {
      setFormError("يرجى ملء العنوان والمحتوى.");
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const payload = {
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
      imageUrl: formImageUrl.trim() || null,
      isPinned: formIsPinned,
    };

    let res;
    if (editingId) {
      res = await apiPut(`/api/admin/news/${editingId}`, payload);
    } else {
      res = await apiPost("/api/admin/news", payload);
    }

    setSubmitting(false);

    if (res.ok) {
      setShowModal(false);
      loadArticles();
    } else {
      setFormError(res.error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت تأكد من رغبتك في حذف هذا الخبر / النصيحة؟")) return;
    const res = await apiDelete(`/api/admin/news/${id}`);
    if (res.ok) {
      loadArticles();
    } else {
      alert(res.error);
    }
  }

  async function togglePin(item: NewsItem) {
    const res = await apiPut(`/api/admin/news/${item.id}`, {
      isPinned: !item.isPinned,
    });
    if (res.ok) {
      loadArticles();
    }
  }

  const filteredArticles = articles.filter((item) => {
    const matchesCat = categoryFilter === "all" || item.category === categoryFilter;
    const matchesSearch =
      !search.trim() ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Newspaper className="h-7 w-7 text-gold" />
            إدارة الأخبار والتحديثات والنصائح اليومية
          </h1>
          <p className="text-sm text-muted">
            انشر أحدث التحديثات، النصائح اليومية، والأخبار لزوار وعملاء متجرك
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-bold shadow-md">
          <Plus className="h-4 w-4" />
          إضافة خبر / نصيحة جديدة
        </Button>
      </div>

      {/* Controls: Search & Category Filter */}
      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted" />
          <Input
            placeholder="بحث في الأخبار والنصائح..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <Button
            size="sm"
            variant={categoryFilter === "all" ? "default" : "outline"}
            onClick={() => setCategoryFilter("all")}
          >
            الكل ({articles.length})
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === "update" ? "default" : "outline"}
            onClick={() => setCategoryFilter("update")}
          >
            🔔 تحديثات ({articles.filter((a) => a.category === "update").length})
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === "tip" ? "default" : "outline"}
            onClick={() => setCategoryFilter("tip")}
          >
            💡 نصائح ({articles.filter((a) => a.category === "tip").length})
          </Button>
          <Button
            size="sm"
            variant={categoryFilter === "news" ? "default" : "outline"}
            onClick={() => setCategoryFilter("news")}
          >
            📰 أخبار ({articles.filter((a) => a.category === "news").length})
          </Button>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {/* Articles List */}
      {loading ? (
        <Card className="p-8 text-center text-muted">جاري تحميل الأخبار والنصائح...</Card>
      ) : filteredArticles.length === 0 ? (
        <Card className="p-12 text-center text-muted">
          لا توجد أخبار أو نصائح مضافة حالياً. أنشئ أول خبر أو نصيحة بالضغط على "إضافة خبر / نصيحة جديدة".
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredArticles.map((item) => {
            const catInfo = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.news;
            const Icon = catInfo.icon;

            return (
              <Card
                key={item.id}
                className={`p-5 flex flex-col justify-between transition-all hover:border-gold/50 ${
                  item.isPinned ? "border-gold/40 bg-gold/5" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={catInfo.tone} className="flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {catInfo.label}
                      </Badge>
                      {item.isPinned && (
                        <Badge tone="gold" className="flex items-center gap-1 font-bold">
                          <Pin className="h-3 w-3 fill-gold" />
                          مثبّت للأعلى
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted">
                      {new Date(item.publishedAt).toLocaleDateString("ar-SA")}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted whitespace-pre-line line-clamp-3">
                    {item.content}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs gap-1"
                    onClick={() => togglePin(item)}
                  >
                    <Pin className={`h-3.5 w-3.5 ${item.isPinned ? "text-gold fill-gold" : ""}`} />
                    {item.isPinned ? "إلغاء التثبيت" : "تثبيت في الأعلى"}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(item)}
                      className="gap-1 text-xs"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(item.id)}
                      className="gap-1 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-xl animate-fade-in p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-gold" />
                {editingId ? "تعديل الخبر / النصيحة" : "إضافة خبر / نصيحة جديدة"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && <Alert tone="danger">{formError}</Alert>}

            <Field label="العنوان">
              <Input
                placeholder="أدخل عنوان التحديث أو النصيحة..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="التصنيف">
                <select
                  value={formCategory}
                  onChange={(e) =>
                    setFormCategory(e.target.value as "update" | "tip" | "news")
                  }
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="news">📰 خبر عام</option>
                  <option value="update">🔔 تحديث جديد</option>
                  <option value="tip">💡 نصيحة يومية</option>
                </select>
              </Field>

              <Field label="رابط الصورة (اختياري)">
                <Input
                  dir="ltr"
                  placeholder="https://..."
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                />
              </Field>
            </div>

            <Field label="المحتوى التفصيلي">
              <textarea
                rows={5}
                placeholder="اكتب تفاصيل التحديث أو النصيحة هنا..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={formIsPinned}
                onChange={(e) => setFormIsPinned(e.target.checked)}
                className="h-4 w-4 rounded border-border text-gold focus:ring-gold"
              />
              <span>تثبيت هذا الخبر في أعلى الصفحة ليراه جميع العملاء فوراً 📌</span>
            </label>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                className="flex-1 font-bold"
                loading={submitting}
                onClick={handleSubmit}
              >
                <Check className="h-4 w-4" />
                {editingId ? "حفظ التعديلات" : "نشر الآن"}
              </Button>
              <Button
                variant="outline"
                disabled={submitting}
                onClick={() => setShowModal(false)}
              >
                إلغاء
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
