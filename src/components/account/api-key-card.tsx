"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api-client";
import { Alert } from "@/components/ui/alert";

export function ApiKeyCard() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchKey();
  }, []);

  async function fetchKey() {
    setLoading(true);
    const res = await apiGet<{ apiKey: string | null }>("/api/account/api-key");
    if (res.ok) {
      setApiKey(res.data.apiKey);
    } else {
      setError("فشل جلب مفتاح API");
    }
    setLoading(false);
  }

  async function generateKey() {
    if (apiKey && !confirm("إنشاء مفتاح جديد سيقوم بإبطال المفتاح القديم. هل أنت متأكد؟")) return;
    
    setGenerating(true);
    setError(null);
    const res = await apiPost<{ apiKey: string }>("/api/account/api-key", {});
    if (res.ok) {
      setApiKey(res.data.apiKey);
      setShow(true);
    } else {
      setError(res.error || "فشل إنشاء المفتاح");
    }
    setGenerating(false);
  }

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>مفتاح الربط البرمجي (API)</CardTitle>
        <CardDescription>
          استخدم هذا المفتاح لربط متجرك الخاص بالمنصة عبر API (متوافق مع SMM Panel v2).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        
        {loading ? (
          <div className="h-10 bg-surface-2 animate-pulse rounded-lg w-full max-w-md"></div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <div className="relative flex-1">
              <Input
                readOnly
                type={show ? "text" : "password"}
                value={apiKey || "لا يوجد مفتاح (قم بإنشائه)"}
                className="pr-10 font-mono text-left"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                disabled={!apiKey}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground disabled:opacity-50"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!apiKey}
                onClick={copyKey}
                className="w-24"
              >
                {copied ? "تم النسخ" : <><Copy className="w-4 h-4 ml-2" /> نسخ</>}
              </Button>
              <Button
                variant="primary"
                onClick={generateKey}
                loading={generating}
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                {apiKey ? "تجديد" : "إنشاء"}
              </Button>
            </div>
          </div>
        )}
        
        <div className="text-sm text-muted">
          <p>رابط الـ API الخاص بك:</p>
          <code className="bg-surface-2 px-2 py-1 rounded text-xs select-all inline-block mt-1 dir-ltr">
            {typeof window !== "undefined" ? window.location.origin : ""}/api/v2
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
