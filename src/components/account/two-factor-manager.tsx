"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiPost } from "@/lib/api-client";

export function TwoFactorManager({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "setup" | "disable">("idle");
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSetup() {
    setLoading(true);
    setError(null);
    const res = await apiPost<{ secret: string; otpauthUrl: string }>(
      "/api/account/2fa/setup",
      {},
    );
    setLoading(false);
    if (res.ok) {
      setSecret(res.data.secret);
      setOtpauth(res.data.otpauthUrl);
      setPhase("setup");
    } else setError(res.error);
  }

  async function confirmEnable() {
    setLoading(true);
    setError(null);
    const res = await apiPost("/api/account/2fa/enable", { code });
    setLoading(false);
    if (res.ok) {
      setPhase("idle");
      setCode("");
      router.refresh();
    } else setError(res.fieldErrors?.code ?? res.error);
  }

  async function confirmDisable() {
    setLoading(true);
    setError(null);
    const res = await apiPost("/api/account/2fa/disable", { code });
    setLoading(false);
    if (res.ok) {
      setPhase("idle");
      setCode("");
      router.refresh();
    } else setError(res.fieldErrors?.code ?? res.error);
  }

  if (enabled && phase !== "disable") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-success" />
          <Badge tone="success">مفعّلة</Badge>
        </div>
        <p className="text-sm text-muted">
          حسابك محميّ بالمصادقة الثنائية عند تسجيل الدخول.
        </p>
        <Button variant="outline" size="sm" onClick={() => setPhase("disable")}>
          <ShieldOff className="h-4 w-4" />
          تعطيل المصادقة الثنائية
        </Button>
      </div>
    );
  }

  if (phase === "disable") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">أدخل رمزًا حاليًا من التطبيق للتعطيل.</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="رمز التحقق" htmlFor="dis-code">
          <Input
            id="dis-code"
            inputMode="numeric"
            maxLength={6}
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center tracking-[0.4em]"
          />
        </Field>
        <div className="flex gap-2">
          <Button variant="danger" size="sm" loading={loading} onClick={confirmDisable}>
            تأكيد التعطيل
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setPhase("idle"); setError(null); }}>
            إلغاء
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "setup" && secret) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          امسح رابط otpauth في تطبيق مصادقة (Google Authenticator، Authy…) أو أدخل
          المفتاح يدويًا، ثم أدخل الرمز الظاهر لتأكيد التفعيل.
        </p>
        <div className="rounded-lg border border-border bg-surface-2/50 p-3">
          <p className="mb-1 text-xs text-muted">المفتاح السري</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all font-mono text-sm" dir="ltr">
              {secret}
            </code>
            <Button
              size="icon"
              variant="ghost"
              aria-label="نسخ"
              onClick={() => navigator.clipboard?.writeText(secret)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {otpauth && (
          <p className="break-all text-[11px] text-muted" dir="ltr">
            {otpauth}
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="رمز التأكيد" htmlFor="en-code">
          <Input
            id="en-code"
            inputMode="numeric"
            maxLength={6}
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center tracking-[0.4em]"
          />
        </Field>
        <div className="flex gap-2">
          <Button size="sm" loading={loading} onClick={confirmEnable}>
            تأكيد وتفعيل
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setPhase("idle"); setError(null); }}>
            إلغاء
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldOff className="h-5 w-5 text-muted" />
        <Badge tone="neutral">غير مفعّلة</Badge>
      </div>
      <p className="text-sm text-muted">
        أضف طبقة حماية ثانية بتطبيق مصادقة — موصى بها بشدّة لحسابات الإدارة.
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button size="sm" loading={loading} onClick={startSetup}>
        <ShieldCheck className="h-4 w-4" />
        تفعيل المصادقة الثنائية
      </Button>
    </div>
  );
}
