"use client";

import { useLocale } from "@/lib/use-locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import type { BankAccount } from "@/server/db/schema";
import { useState } from "react";

const T = {
  ar: {
    title: "حساباتنا البنكية",
    accountName: "اسم الحساب",
    accountNumber: "رقم الحساب",
    iban: "رقم الآيبان",
    copied: "تم النسخ!",
    empty: "لا توجد حسابات بنكية متاحة حالياً.",
  },
  en: {
    title: "Our Bank Accounts",
    accountName: "Account Name",
    accountNumber: "Account Number",
    iban: "IBAN",
    copied: "Copied!",
    empty: "No bank accounts currently available.",
  },
};

export function BankAccountsDisplay({ accounts }: { accounts: BankAccount[] }) {
  const locale = useLocale();
  const t = T[locale];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!accounts || accounts.length === 0) {
    return (
      <Card className="p-6 text-center text-muted">
        {t.empty}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg sm:text-xl font-bold">{t.title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {accounts.map((account) => (
          <Card key={account.id} className="relative overflow-hidden p-4 sm:p-5 border border-border bg-surface shadow-sm">
            <div className="absolute top-0 right-0 h-full w-1.5 bg-gold/90" />
            <h3 className="mb-3 text-base sm:text-lg font-bold text-foreground break-words">{account.bankName}</h3>

            <div className="space-y-3 text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-muted">{t.accountName}</span>
                <span className="font-medium text-foreground break-words">{account.accountName}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-muted">{t.accountNumber}</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium font-mono text-sm sm:text-base break-all text-foreground">{account.accountNumber}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted hover:text-gold"
                    onClick={() => copyToClipboard(account.accountNumber, `acc_${account.id}`)}
                  >
                    {copiedId === `acc_${account.id}` ? <span className="text-xs font-bold text-emerald-500">{t.copied}</span> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {account.iban && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted">{t.iban}</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium font-mono text-xs sm:text-sm break-all text-foreground">{account.iban}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-muted hover:text-gold"
                      onClick={() => copyToClipboard(account.iban!, `iban_${account.id}`)}
                    >
                      {copiedId === `iban_${account.id}` ? <span className="text-xs font-bold text-emerald-500">{t.copied}</span> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {account.notes && (
                <div className="mt-3 rounded-lg border border-border/60 bg-surface-2/80 p-3 text-xs leading-relaxed text-muted break-words whitespace-pre-wrap">
                  {account.notes}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
