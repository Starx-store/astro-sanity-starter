"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: { ariaLabel: "عملة العرض", usd: "دولار $" },
  en: { ariaLabel: "Display currency", usd: "USD $" },
} as const;

/**
 * مبدّل عملة العرض — يخزّن الاختيار في كوكي ويعيد تحميل بيانات الصفحة.
 * التحويل عرضي فقط؛ الدفع الفعلي بالدولار دائمًا.
 */
export function CurrencySwitcher({
  currencies,
  selected,
}: {
  currencies: { code: string; label: string }[];
  selected: string;
}) {
  const router = useRouter();
  const t = T[useLocale()];
  if (currencies.length === 0) return null;

  return (
    <select
      aria-label={t.ariaLabel}
      className="h-9 rounded-lg border border-border bg-input px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      value={selected}
      onChange={(e) => {
        document.cookie = `evo_currency=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      <option value="USD">{t.usd}</option>
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
