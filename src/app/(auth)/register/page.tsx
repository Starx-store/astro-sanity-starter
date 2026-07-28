"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { GoogleButton } from "@/components/auth/google-button";
import { apiPost } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    title: "إنشاء حساب",
    desc: "ابدأ رحلتك مع Evo Store خلال دقيقة.",
    orEmail: "أو بالبريد",
    name: "الاسم",
    email: "البريد الإلكتروني",
    phone: "رقم الواتساب (WhatsApp Number)",
    password: "كلمة المرور",
    passwordHint: "8 أحرف على الأقل، مع حرف ورقم.",
    confirmPassword: "تأكيد كلمة المرور",
    submit: "إنشاء الحساب",
    haveAccount: "لديك حساب بالفعل؟",
    signIn: "تسجيل الدخول",
    referredBy: "أنت تقوم بالتسجيل بدعوة من صديق ✨",
  },
  en: {
    title: "Create account",
    desc: "Get started with Evo Store in a minute.",
    orEmail: "or with email",
    name: "Name",
    email: "Email",
    phone: "WhatsApp Number",
    password: "Password",
    passwordHint: "At least 8 characters, with a letter and a number.",
    confirmPassword: "Confirm password",
    submit: "Create account",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    referredBy: "You are registering via a friend's invitation ✨",
  },
} as const;

type RegisterResponse = {
  user: { id: string; name: string; email: string };
  needsVerification?: boolean;
};

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");
  
  const t = T[useLocale()];
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const res = await apiPost<RegisterResponse>("/api/auth/register", {
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      password: fd.get("password"),
      confirmPassword: fd.get("confirmPassword"),
      referralCode: refCode || undefined,
    });
    setLoading(false);
    if (res.ok) {
      router.push(res.data.needsVerification ? "/verify" : "/account");
      router.refresh();
    } else {
      if (res.fieldErrors) setErrors(res.fieldErrors);
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
            <GoogleButton />
            <div className="my-4 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" />
              {t.orEmail}
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        {refCode && (
          <div className="mb-4 rounded bg-primary/10 p-3 text-center text-sm font-medium text-primary">
            {t.referredBy}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label={t.name} htmlFor="name" error={errors.name}>
            <Input id="name" name="name" invalid={!!errors.name} required />
          </Field>
          <Field label={t.email} htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="you@example.com"
              invalid={!!errors.email}
              required
            />
          </Field>
          <Field
            label={t.phone}
            htmlFor="phone"
            error={errors.phone}
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              dir="ltr"
              placeholder="+9677xxxxxxxx"
              invalid={!!errors.phone}
              required
            />
            <p className="mt-1 text-xs text-muted">سيتم إرسال الإشعارات وتحديثات الطلبات إلى هذا الرقم.</p>
          </Field>
          <Field
            label={t.password}
            htmlFor="password"
            error={errors.password}
            hint={t.passwordHint}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.password}
              required
            />
          </Field>
          <Field
            label={t.confirmPassword}
            htmlFor="confirmPassword"
            error={errors.confirmPassword}
          >
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.confirmPassword}
              required
            />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            {t.submit}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {t.haveAccount}{" "}
          <Link href="/login" className="font-medium text-gold hover:underline">
            {t.signIn}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
