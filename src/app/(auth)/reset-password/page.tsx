"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    title: "تعيين كلمة مرور جديدة",
    desc: "اختر كلمة مرور قوية لحسابك.",
    invalidLink: "رابط غير صالح: رمز الاستعادة مفقود.",
    newPassword: "كلمة المرور الجديدة",
    passwordHint: "8 أحرف على الأقل، مع حرف ورقم.",
    confirmPassword: "تأكيد كلمة المرور",
    submit: "حفظ كلمة المرور",
    backToLogin: "العودة لتسجيل الدخول",
  },
  en: {
    title: "Set a new password",
    desc: "Choose a strong password for your account.",
    invalidLink: "Invalid link: the reset token is missing.",
    newPassword: "New password",
    passwordHint: "At least 8 characters, with a letter and a number.",
    confirmPassword: "Confirm password",
    submit: "Save password",
    backToLogin: "Back to sign in",
  },
} as const;

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const t = T[useLocale()];
  const token = params.get("token") || "";

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const res = await apiPost("/api/auth/reset-password", {
      token,
      password: fd.get("password"),
      confirmPassword: fd.get("confirmPassword"),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/login");
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
        {!token && (
          <Alert tone="danger" className="mb-4">
            {t.invalidLink}
          </Alert>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field
            label={t.newPassword}
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
          <Button
            type="submit"
            className="w-full"
            loading={loading}
            disabled={!token}
          >
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
