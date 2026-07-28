import "server-only";
import { cookies } from "next/headers";

export type Locale = "ar" | "en";
export const LOCALE_COOKIE = "evo_locale";

/** لغة الواجهة الحالية من الكوكي — العربية افتراضيًا. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "en" ? "en" : "ar";
}
