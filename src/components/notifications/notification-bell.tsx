"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: { notifications: "الإشعارات" },
  en: { notifications: "Notifications" },
} as const;

/** جرس الإشعارات في الهيدر — يستطلع عدد غير المقروء دوريًا. */
export function NotificationBell() {
  const t = T[useLocale()];
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/notifications/unread", {
          cache: "no-store",
        });
        const json = await res.json();
        if (alive && json?.ok) setUnread(json.data.unread ?? 0);
      } catch {
        /* تجاهل */
      }
    }
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      aria-label={t.notifications}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
