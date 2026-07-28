"use client";

import { useState } from "react";
import { useLocale } from "@/lib/use-locale";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

const T = {
  ar: {
    title: "رسالة جماعية",
    desc: "إرسال إشعار داخل التطبيق لجميع المستخدمين النشطين.",
    subject: "العنوان",
    body: "النص",
    send: "إرسال الرسالة",
    sending: "جاري الإرسال...",
    confirm: "هل أنت متأكد من رغبتك في إرسال هذا الإشعار لجميع المستخدمين؟",
    success: (count: number) => `تم إرسال الإشعار بنجاح لـ ${count} مستخدم.`,
  },
  en: {
    title: "Broadcast Message",
    desc: "Send an in-app notification to all active users.",
    subject: "Subject",
    body: "Body",
    send: "Send Message",
    sending: "Sending...",
    confirm: "Are you sure you want to send this notification to ALL active users?",
    success: (count: number) => `Successfully sent notification to ${count} users.`,
  }
};

export function BroadcastForm() {
  const locale = useLocale();
  const t = T[locale];

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(t.confirm)) return;

    setIsLoading(true);
    setError(null);
    setFieldErrors({});
    setSuccessCount(null);

    const res = await apiPost<{ count: number }>("/api/admin/broadcast", {
      title,
      body,
    });

    setIsLoading(false);

    if (res.ok) {
      setSuccessCount(res.data.count);
      setTitle("");
      setBody("");
    } else {
      setError(res.error);
      if (res.fieldErrors) {
        setFieldErrors(res.fieldErrors);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <p className="text-sm text-muted">{t.desc}</p>
      </CardHeader>
      <CardContent>
        {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
        {successCount !== null && (
          <Alert variant="success" className="mb-4">{t.success(successCount)}</Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t.subject} error={fieldErrors.title}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              invalid={!!fieldErrors.title}
              required
            />
          </Field>
          <Field label={t.body} error={fieldErrors.body}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isLoading}
              className={`min-h-[100px] w-full rounded-lg border bg-input px-4 py-2 text-sm text-foreground placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 ${
                fieldErrors.body ? "border-danger focus:ring-danger" : "border-border"
              }`}
            />
          </Field>
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? t.sending : t.send}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
