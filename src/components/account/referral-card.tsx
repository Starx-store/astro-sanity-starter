"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/use-locale";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Share2 } from "lucide-react";

type ReferralStats = {
  totalReferred: number;
  totalEarnings: string;
  referrals: Array<{
    name: string;
    email: string;
    joinedAt: string;
    totalEarnings: string;
  }>;
};

const T = {
  ar: {
    title: "نظام الإحالة",
    desc: "شارك رابطك الخاص واربح عمولة على مشتريات أصدقائك.",
    yourLink: "رابط الإحالة الخاص بك",
    copy: "نسخ",
    copied: "تم النسخ!",
    stats: "الإحصائيات",
    referred: "المدعوين",
    earnings: "الأرباح",
  },
  en: {
    title: "Referral System",
    desc: "Share your link and earn commission on your friends' purchases.",
    yourLink: "Your Referral Link",
    copy: "Copy",
    copied: "Copied!",
    stats: "Statistics",
    referred: "Referred",
    earnings: "Earnings",
  },
};

export function ReferralCard() {
  const t = T[useLocale()];
  const [data, setData] = useState<{ code: string; stats: ReferralStats } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setData(json.data);
      });
  }, []);

  if (!data) return null; // Or a skeleton

  const link = typeof window !== "undefined" ? `${window.location.origin}/register?ref=${data.code}` : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <p className="text-sm text-muted">{t.desc}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t.yourLink}</label>
          <div className="flex items-center gap-2">
            <Input readOnly value={link} dir="ltr" className="flex-1 font-mono text-sm" />
            <Button variant="secondary" onClick={copyToClipboard} className="shrink-0 gap-2">
              {copied ? <Badge tone="success">{t.copied}</Badge> : <><Copy className="h-4 w-4" /> {t.copy}</>}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface-2/40 p-4">
          <div className="space-y-1">
            <div className="text-sm text-muted">{t.referred}</div>
            <div className="text-2xl font-bold">{data.stats.totalReferred}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted">{t.earnings}</div>
            <div className="text-2xl font-bold text-success">${data.stats.totalEarnings}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
