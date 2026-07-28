"use client";

export type Locale = "ar" | "en";

/**
 * لغة الواجهة داخل مكوّنات العميل — تُقرأ من الكوكي مباشرة.
 * (الصفحة تُعاد بالكامل عند التبديل عبر router.refresh فلا حاجة لحالة تفاعلية.)
 */
export function useLocale(): Locale {
  if (typeof document === "undefined") return "ar";
  return document.cookie.includes("evo_locale=en") ? "en" : "ar";
}
