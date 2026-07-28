"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

/** تبديل لغة الواجهة (عربي ⇄ إنجليزي) عبر كوكي + إعادة تحميل الشجرة. */
export function LangToggle({ locale }: { locale: "ar" | "en" }) {
  const router = useRouter();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `evo_locale=${next};path=/;max-age=31536000;samesite=lax`;
        router.refresh();
      }}
      className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:text-gold"
      aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      <Languages className="h-4 w-4" />
      {locale === "ar" ? "EN" : "ع"}
    </button>
  );
}
