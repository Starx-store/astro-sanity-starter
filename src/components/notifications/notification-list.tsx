"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLocale, type Locale } from "@/lib/use-locale";

const T = {
  ar: {
    loading: "جارٍ التحميل…",
    empty: "لا توجد إشعارات بعد.",
    markAll: "تعليم الكل كمقروء",
  },
  en: {
    loading: "Loading…",
    empty: "No notifications yet.",
    markAll: "Mark all as read",
  },
} as const;

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

function hrefFor(item: Item): string | null {
  const m = item.metadata ?? {};
  if (typeof m.orderId === "string") return `/orders/${m.orderId}`;
  if (typeof m.ticketId === "string") return `/support/${m.ticketId}`;
  if (item.type.startsWith("deposit") || item.type.startsWith("wallet"))
    return "/wallet";
  return null;
}

function timeAgo(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function NotificationList() {
  const router = useRouter();
  const locale = useLocale();
  const t = T[locale];
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) setItems(json.data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markAll() {
    setMarking(true);
    await fetch("/api/notifications/read-all", { method: "POST" });
    setMarking(false);
    setItems((prev) =>
      prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })),
    );
    router.refresh();
  }

  async function open(item: Item) {
    if (!item.readAt) {
      await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
    }
    const href = hrefFor(item);
    if (href) router.push(href);
    else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i,
        ),
      );
    }
  }

  const hasUnread = items.some((i) => !i.readAt);

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted">{t.loading}</p>;
  }

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <BellOff className="h-8 w-8 text-muted" />
        <p className="text-muted">{t.empty}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" loading={marking} onClick={markAll}>
            <CheckCheck className="h-4 w-4" />
            {t.markAll}
          </Button>
        </div>
      )}
      {items.map((item) => {
        const linkable = hrefFor(item);
        const Inner = (
          <Card
            className={cn(
              "cursor-pointer p-4 transition-colors hover:border-gold/40",
              !item.readAt && "border-gold/40 bg-gold/5",
            )}
            onClick={() => open(item)}
          >
            <div className="flex items-start gap-3">
              {!item.readAt && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
              )}
              <div className={cn("flex-1", item.readAt && "pr-5")}>
                <p className="font-semibold">{item.title}</p>
                {item.body && (
                  <p className="mt-0.5 text-sm text-muted">{item.body}</p>
                )}
                <p className="mt-1 text-[11px] text-muted">
                  {timeAgo(item.createdAt, locale)}
                </p>
              </div>
            </div>
          </Card>
        );
        return linkable ? (
          <Link key={item.id} href={linkable} onClick={() => open(item)}>
            {Inner}
          </Link>
        ) : (
          <div key={item.id}>{Inner}</div>
        );
      })}
    </div>
  );
}
