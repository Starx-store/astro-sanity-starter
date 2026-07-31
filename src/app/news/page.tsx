import Link from "next/link";
import { Newspaper, Bell, Lightbulb, Pin, ChevronLeft, AlertCircle } from "lucide-react";
import { getPublishedNews } from "@/server/news/service";
import { getSetting } from "@/server/settings/service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getLocale } from "@/server/locale";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, { label: string; tone: "gold" | "info" | "success"; icon: any }> = {
  update: { label: "تحديث جديد", tone: "info", icon: Bell },
  tip: { label: "نصيحة يومية", tone: "gold", icon: Lightbulb },
  news: { label: "خبر عام", tone: "success", icon: Newspaper },
};

export async function generateMetadata() {
  return {
    title: "الأخبار والتحديثات والنصائح اليومية | Evo Store",
    description: "تابع أحدث الأخبار والتحديثات والنصائح اليومية الخاصة بمنتجات وخدمات المتجر.",
  };
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; q?: string }>;
}) {
  const isNewsEnabled = (await getSetting<boolean>("feature.news_enabled", true)) !== false;

  if (!isNewsEnabled) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <SiteHeader />
        <main className="flex-1 mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
          <Alert tone="warning" className="justify-center text-base p-6">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <span>صفحة الأخبار والتحديثات معطّلة حالياً بقرار من الإدارة.</span>
          </Alert>
          <Link href="/" className="inline-block text-sm text-gold hover:underline font-bold">
            العودة للصفحة الرئيسية ←
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { cat, q } = await searchParams;
  const articles = await getPublishedNews({
    category: cat,
    search: q,
  });

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-5xl space-y-8 px-4 py-10 w-full">
      {/* Hero Header */}
      <div className="text-center space-y-3">
        <Badge tone="gold" className="px-3 py-1 text-xs font-bold gap-1">
          <Newspaper className="h-3.5 w-3.5" />
          تحديثات ونصائح يومية
        </Badge>
        <h1 className="text-3xl font-black text-foreground sm:text-4xl">
          الأخبار والتحديثات والنصائح اليومية 📰
        </h1>
        <p className="mx-auto max-w-2xl text-muted text-sm sm:text-base">
          ابقَ على اطلاع دائم بجديد الخدمات، النصائح التقنية اليومية، وإعلانات المتجر الهامة.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border/60 pb-4">
        <Link
          href="/news"
          className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
            !cat ? "bg-gold text-gold-foreground" : "bg-surface-2/60 text-muted hover:text-foreground"
          }`}
        >
          الكل
        </Link>
        <Link
          href="/news?cat=update"
          className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
            cat === "update" ? "bg-info text-info-foreground" : "bg-surface-2/60 text-muted hover:text-foreground"
          }`}
        >
          🔔 التحديثات
        </Link>
        <Link
          href="/news?cat=tip"
          className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
            cat === "tip" ? "bg-gold text-gold-foreground" : "bg-surface-2/60 text-muted hover:text-foreground"
          }`}
        >
          💡 النصائح اليومية
        </Link>
        <Link
          href="/news?cat=news"
          className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
            cat === "news" ? "bg-success text-success-foreground" : "bg-surface-2/60 text-muted hover:text-foreground"
          }`}
        >
          📰 الأخبار العامة
        </Link>
      </div>

      {/* Articles Grid */}
      {articles.length === 0 ? (
        <Card className="p-12 text-center text-muted">
          لا توجد أخبار أو نصائح في هذا التصنيف حالياً.
        </Card>
      ) : (
        <div className="space-y-4">
          {articles.map((item) => {
            const catInfo = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.news;
            const Icon = catInfo.icon;

            return (
              <Card
                key={item.id}
                className={`p-6 transition-all hover:border-gold/40 shadow-sm ${
                  item.isPinned ? "border-gold/50 bg-gradient-to-r from-gold/10 via-surface to-surface" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={catInfo.tone} className="flex items-center gap-1">
                        <Icon className="h-3.5 w-3.5" />
                        {catInfo.label}
                      </Badge>
                      {item.isPinned && (
                        <Badge tone="gold" className="flex items-center gap-1 font-bold">
                          <Pin className="h-3.5 w-3.5 fill-gold" />
                          إعلان مثبت
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted">
                      {new Date(item.publishedAt).toLocaleDateString("ar-SA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-foreground">{item.title}</h2>

                  {item.imageUrl && (
                    <div className="my-3 overflow-hidden rounded-xl border border-border">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="max-h-80 w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                    {item.content}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      </main>
      <SiteFooter />
    </div>
  );
}
