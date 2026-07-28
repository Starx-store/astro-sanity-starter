import "server-only";
import { cookies } from "next/headers";
import { getSetting } from "@/server/settings/service";

/**
 * عملات العرض — المحفظة والتسعير الفعلي بالدولار دائمًا، وهذه تحويلات
 * عرض تقريبية بأسعار صرف يحددها الأدمن من الإعدادات.
 */

export interface DisplayCurrency {
  code: string;
  label: string;
  /** كم وحدة من هذه العملة يساوي 1 دولار. */
  rate: number;
}

export const CURRENCY_COOKIE = "evo_currency";

const DEFS: Array<{ code: string; label: string; settingKey: string; def: number }> = [
  { code: "SAR", label: "ريال سعودي", settingKey: "currencies.sar_rate", def: 4 },
  {
    code: "YERS",
    label: "ريال يمني (جنوبي)",
    settingKey: "currencies.yers_rate",
    def: 1600,
  },
  {
    code: "YERO",
    label: "ريال يمني (قديم)",
    settingKey: "currencies.yero_rate",
    def: 550,
  },
];

/** العملات المفعّلة (سعر > 0). */
export async function getDisplayCurrencies(): Promise<DisplayCurrency[]> {
  const out: DisplayCurrency[] = [];
  for (const d of DEFS) {
    const rate = Number(await getSetting<number | string>(d.settingKey, d.def));
    if (Number.isFinite(rate) && rate > 0) {
      out.push({ code: d.code, label: d.label, rate });
    }
  }
  return out;
}

/** العملة المختارة من كوكي الزائر (null = دولار). */
export async function getSelectedCurrency(): Promise<DisplayCurrency | null> {
  const code = (await cookies()).get(CURRENCY_COOKIE)?.value;
  if (!code || code === "USD") return null;
  const all = await getDisplayCurrencies();
  return all.find((c) => c.code === code) ?? null;
}

/** تنسيق مبلغ دولاري (نص عشري) بعملة العرض. */
export function convertDisplay(
  usdAmount: string | number,
  currency: DisplayCurrency,
): string {
  const usd = Number(usdAmount);
  if (!Number.isFinite(usd)) return String(usdAmount);
  const v = usd * currency.rate;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : 2 })} ${currency.label}`;
}
