"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: { darkMode: "الوضع الليلي", lightMode: "الوضع النهاري" },
  en: { darkMode: "Dark mode", lightMode: "Light mode" },
} as const;

/**
 * مبدّل الوضع الليلي/النهاري — يضيف الصنف `light` على <html> ويحفظ
 * الاختيار محليًا. الوضع الافتراضي داكن (هوية المتجر).
 */
export function ThemeToggle() {
  const t = T[useLocale()];
  const [light, setLight] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
    setReady(true);
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("evo-theme", next ? "light" : "dark");
    } catch {
      /* التخزين المحلي قد يكون معطّلًا — التبديل يظل يعمل للجلسة */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? t.darkMode : t.lightMode}
      title={light ? t.darkMode : t.lightMode}
      className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted transition-colors hover:text-gold"
    >
      {ready && light ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}

/**
 * سكربت يعمل قبل الرسم لمنع وميض الوضع الخاطئ (FOUC).
 * يُحقن في <head> ويقرأ الاختيار المحفوظ.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('evo-theme');if(t==='light'){document.documentElement.classList.add('light')}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
