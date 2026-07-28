"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { GoogleButton, googleErrorMessage } from "@/components/auth/google-button";
import { apiPost } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    title: "تسجيل الدخول",
    desc: "مرحبًا بعودتك إلى Evo Store.",
    orEmail: "أو بالبريد",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    totpLabel: "رمز المصادقة الثنائية",
    totpHint: "6 أرقام من تطبيق المصادقة",
    totpRequired: "أدخل رمز المصادقة الثنائية من تطبيقك لإكمال الدخول.",
    forgot: "نسيت كلمة المرور؟",
    submit: "دخول",
    noAccount: "ليس لديك حساب؟",
    createOne: "أنشئ حسابًا",
  },
  en: {
    title: "Sign in",
    desc: "Welcome back to Evo Store.",
    orEmail: "or with email",
    email: "Email",
    password: "Password",
    totpLabel: "Two-factor code",
    totpHint: "6-digit code from your authenticator app",
    totpRequired: "Enter the two-factor code from your authenticator app to finish signing in.",
    forgot: "Forgot password?",
    submit: "Sign in",
    noAccount: "Don't have an account?",
    createOne: "Create one",
  },
} as const;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();
  const t = T[locale];
  const next = params.get("next") || "/account";
  const oauthError = googleErrorMessage(params.get("error"), locale);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [need2fa, setNeed2fa] = useState(false);

  // مسجّل بجلسة صالحة فعلًا؟ حوّله — التحقق هنا (لا في middleware) كي لا
  // يعلق صاحب كوكي بجلسة ميتة في حلقة تحويل لا نهائية.
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.data?.user) {
          router.replace(next);
          router.refresh();
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [router, next]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const res = await apiPost<unknown>("/api/auth/login", {
      email: fd.get("email"),
      password: fd.get("password"),
      totp: fd.get("totp") || undefined,
    });
    setLoading(false);
    if (res.ok) {
      router.push(next);
      router.refresh();
    } else if (res.code === "2fa_required") {
      setNeed2fa(true);
      setFormError(t.totpRequired);
    } else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setNeed2fa(res.code === "2fa_invalid" ? true : need2fa);
      setFormError(res.error);
    }
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
          <>
            <GoogleButton next={next} />
            <div className="my-4 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" />
              {t.orEmail}
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {oauthError && <Alert tone="danger">{oauthError}</Alert>}
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label={t.email} htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              placeholder="you@example.com"
              invalid={!!errors.email}
              required
            />
          </Field>
          <Field label={t.password} htmlFor="password" error={errors.password}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.password}
              required
            />
          </Field>
          {need2fa && (
            <Field
              label={t.totpLabel}
              htmlFor="totp"
              error={errors.totp}
              hint={t.totpHint}
            >
              <Input
                id="totp"
                name="totp"
                inputMode="numeric"
                maxLength={6}
                dir="ltr"
                autoFocus
                placeholder="______"
                className="text-center text-lg tracking-[0.5em]"
              />
            </Field>
          )}
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-gold hover:underline"
            >
              {t.forgot}
            </Link>
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            {t.submit}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {t.noAccount}{" "}
          <Link href="/register" className="font-medium text-gold hover:underline">
            {t.createOne}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
