"use client";

import { useLocale, type Locale } from "@/lib/use-locale";

const T = {
  ar: { continueWithGoogle: "المتابعة عبر Google" },
  en: { continueWithGoogle: "Continue with Google" },
} as const;

/**
 * زر «الدخول بجوجل» — ينتقل لمسار بدء OAuth مع مسار العودة.
 * يُعرض فقط عندما يكون Google مضبوطًا (يتحكم به الأب).
 */
export function GoogleButton({ next }: { next?: string }) {
  const t = T[useLocale()];
  // معرّف العميل عام — نظهر الزر فقط عند ضبطه.
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  const href = next
    ? `/api/auth/google?next=${encodeURIComponent(next)}`
    : "/api/auth/google";

  return (
    <a
      href={href}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-input text-sm font-medium transition-colors hover:bg-surface-2"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
        />
      </svg>
      {t.continueWithGoogle}
    </a>
  );
}

const GOOGLE_ERRORS: Record<Locale, Record<string, string>> = {
  ar: {
    google_off: "الدخول بجوجل غير مفعّل حاليًا.",
    google_denied: "أُلغيت المصادقة مع جوجل.",
    google_state: "انتهت صلاحية الجلسة — حاول مرة أخرى.",
    google_failed: "تعذّر تسجيل الدخول بجوجل — حاول مرة أخرى.",
    google_no_email: "حساب جوجل لا يحتوي بريدًا صالحًا.",
  },
  en: {
    google_off: "Google sign-in is currently disabled.",
    google_denied: "Google authentication was cancelled.",
    google_state: "Your session expired — please try again.",
    google_failed: "Could not sign in with Google — please try again.",
    google_no_email: "This Google account has no valid email address.",
  },
};

export function googleErrorMessage(
  code: string | null | undefined,
  locale: Locale = "ar",
): string | null {
  return code ? (GOOGLE_ERRORS[locale][code] ?? null) : null;
}
