"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { apiPost } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: {
    title: "تأكيد البريد الإلكتروني",
    desc: "أدخل رمز التحقق المكوّن من 6 أرقام. اضغط «إرسال رمز جديد» للحصول عليه.",
    devOtp: "رمزك (وضع التطوير):",
    alreadyVerified: "بريدك مؤكّد بالفعل — يمكنك المتابعة.",
    codeSent: "تم إرسال رمز جديد إلى بريدك.",
    codeLabel: "رمز التحقق",
    submit: "تأكيد",
    sending: "جارٍ الإرسال…",
    resend: "إرسال رمز جديد",
    footnote:
      "إرسال البريد الفعلي غير مُفعّل بعد؛ في وضع التطوير يظهر الرمز هنا وفي سجلّ الخادم. التحقق اختياري ولا يمنع استخدام المتجر.",
  },
  en: {
    title: "Verify your email",
    desc: "Enter the 6-digit verification code. Tap “Send new code” to get one.",
    devOtp: "Your code (dev mode):",
    alreadyVerified: "Your email is already verified — you can continue.",
    codeSent: "A new code has been sent to your email.",
    codeLabel: "Verification code",
    submit: "Verify",
    sending: "Sending…",
    resend: "Send new code",
    footnote:
      "Real email delivery isn't enabled yet; in dev mode the code appears here and in the server log. Verification is optional and doesn't block using the store.",
  },
} as const;

export default function VerifyPage() {
  const router = useRouter();
  const t = T[useLocale()];
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setError(undefined);
    const fd = new FormData(e.currentTarget);
    const res = await apiPost("/api/auth/verify", { code: fd.get("code") });
    setLoading(false);
    if (res.ok) {
      router.push("/account");
      router.refresh();
    } else {
      if (res.fieldErrors?.code) setError(res.fieldErrors.code);
      setFormError(res.error);
    }
  }

  async function resend() {
    setResending(true);
    setFormError(null);
    setDevOtp(null);
    setNotice(null);
    const res = await apiPost<{ devOtp?: string; alreadyVerified?: boolean }>(
      "/api/auth/resend-verification",
      {},
    );
    setResending(false);
    if (res.ok) {
      if (res.data.alreadyVerified) {
        setNotice(t.alreadyVerified);
        router.push("/account");
        router.refresh();
      } else if (res.data.devOtp) {
        setDevOtp(res.data.devOtp);
      } else {
        setNotice(t.codeSent);
      }
    } else {
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
        {devOtp && (
          <Alert tone="success" className="mb-4">
            {t.devOtp}{" "}
            <span className="font-mono text-lg font-bold tracking-widest" dir="ltr">
              {devOtp}
            </span>
          </Alert>
        )}
        {notice && (
          <Alert tone="info" className="mb-4">
            {notice}
          </Alert>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label={t.codeLabel} htmlFor="code" error={error}>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              maxLength={6}
              dir="ltr"
              placeholder="______"
              className="text-center text-lg tracking-[0.5em]"
              invalid={!!error}
              defaultValue={devOtp ?? undefined}
              required
            />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            {t.submit}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="text-sm font-medium text-gold hover:underline disabled:opacity-50"
          >
            {resending ? t.sending : t.resend}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-muted">{t.footnote}</p>
      </CardContent>
    </Card>
  );
}
