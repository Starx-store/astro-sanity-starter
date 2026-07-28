"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Props {
  enabled: boolean;
  text: string;
  link?: string | null;
  badge?: string | null;
}

export function AnnouncementBar({ enabled, text, link, badge }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (enabled && text) {
      const dismissed = sessionStorage.getItem("announcement_dismissed");
      if (!dismissed) {
        setVisible(true);
      }
    }
  }, [enabled, text]);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem("announcement_dismissed", "1");
    setVisible(false);
  }

  const content = (
    <div className="flex items-center justify-center gap-2">
      {badge && <Badge tone="gold" className="text-[10px] uppercase leading-none py-0.5">{badge}</Badge>}
      <span className="text-sm font-medium">{text}</span>
    </div>
  );

  return (
    <div className="relative bg-primary text-primary-foreground px-4 py-2 text-center w-full z-50 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-center pr-8">
        {link ? (
          <Link href={link} className="hover:underline">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
      <button
        onClick={dismiss}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded-full transition-colors rtl:left-auto rtl:right-2"
        aria-label="إغلاق"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
