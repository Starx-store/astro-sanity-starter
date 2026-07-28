"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    title: "استعادة كلمة المرور",
    desc: "أدخل بريدك وسنرسل لك تعليمات إعادة التعيين.",
    devToken: "رمز التطوير:",
    continueReset: "متابعة إعادة التعيين",
    email: "البريد الإلكتروني",
    submit: "إرسال التعليمات",
    backToLogin: "العودة لتسجيل الدخول",
  },
  en: {
    title: "Reset your password",
    desc: "Enter your email and we'll send you reset instructions.",
    devToken: "Dev token:",
    continueReset: "Continue password reset",
    email: "Email",
    submit: "Send instructions",
    backToLogin: "Back to sign in",
  },
} as const;

export default function ForgotPasswordPage() {
  const t = T[useLocale()];
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(undefined);
    setDevToken(null);
    const fd = new FormData(e.currentTarget);
    const res = await apiPost<{ message: string; devToken?: string }>(
      "/api/auth/forgot-password",
      { email: fd.get("email") },
    );
    setLoading(false);
    if (res.ok) {
      setMessage(res.data.message);
      if (res.data.devToken) setDevToken(res.data.devToken);
    } else {
      setError(res.fieldErrors?.email);
      setMessage(res.error);
    }
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.desc}</CardDescription>
      </CardHeader>
      <CardContent>
        {message && <Alert tone="info" className="mb-4">{message}</Alert>}
        {devToken && (
          <Alert tone="warning" className="mb-4">
            {t.devToken}{" "}
            <Link
              href={`/reset-password?token=${devToken}`}
              className="font-medium underline"
            >
              {t.continueReset}
            </Link>
          </Alert>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t.email} htmlFor="email" error={error}>
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              placeholder="you@example.com"
              invalid={!!error}
              required
            />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            {t.submit}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-gold hover:underline">
            {t.backToLogin}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
