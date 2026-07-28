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
      <Card className="p-6 text-center text-gray-500">
        {t.empty}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{t.title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((account) => (
          <Card key={account.id} className="p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-primary/80" />
            <h3 className="font-bold text-lg mb-4">{account.bankName}</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400">{t.accountName}</span>
                <span className="font-medium">{account.accountName}</span>
              </div>
              
              <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400">{t.accountNumber}</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium font-mono text-base">{account.accountNumber}</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-gray-500 hover:text-primary"
                    onClick={() => copyToClipboard(account.accountNumber, `acc_${account.id}`)}
                  >
                    {copiedId === `acc_${account.id}` ? <span className="text-xs text-green-500">{t.copied}</span> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {account.iban && (
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400">{t.iban}</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium font-mono text-xs">{account.iban}</span>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-gray-500 hover:text-primary"
                      onClick={() => copyToClipboard(account.iban!, `iban_${account.id}`)}
                    >
                      {copiedId === `iban_${account.id}` ? <span className="text-xs text-green-500">{t.copied}</span> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              
              {account.notes && (
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 p-2 rounded">
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
