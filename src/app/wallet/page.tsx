import { desc, eq } from "drizzle-orm";
import { Wallet as WalletIcon, Lock, Coins } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import {
  wallets,
  walletTransactions,
  depositRequests,
} from "@/server/db/schema";
import { getMinDeposit } from "@/server/wallet/deposits";
import { isBinanceEnabled } from "@/server/payments/binance/client";
import { parseAmount, displayAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { depositStatusLabel, depositMethodLabel } from "@/lib/labels";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DepositForm } from "@/components/wallet/deposit-form";
import { BinanceDeposit } from "@/components/wallet/binance-deposit";
import { CryptoDeposit } from "@/components/wallet/crypto-deposit";
import { getCryptoConfig } from "@/server/wallet/crypto-deposits";
import { getSelectedCurrency } from "@/server/currency";
import { getLocale } from "@/server/locale";
import { TxTable } from "@/components/wallet/tx-table";
import { BankAccountsDisplay } from "@/components/wallet/bank-accounts-display";
import { listActiveBankAccounts } from "@/server/bank-accounts/service";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    available: "الرصيد المتاح",
    total: "الرصيد الإجمالي",
    held: "المحجوز للطلبات",
    title: "المحفظة",
    subtitle: "اشحن رصيدك وتابع كل حركاتك المالية بدقة.",
    binanceTitle: "شحن تلقائي — Binance Pay ⚡",
    binanceDesc: "ادفع بمحفظة Binance ويُضاف الرصيد تلقائيًا فور التأكيد.",
    binanceDisabled:
      "غير مفعّل حاليًا — تُضاف مفاتيح Binance Pay في إعدادات الخادم لتفعيله.",
    cryptoTitle: "شحن بعملة رقمية (BEP20)",
    cryptoDesc: "USDT / USDC / BUSD — يُشحن رصيدك تلقائيًا بعد تأكيد الشبكة.",
    manualTitle: "طلب شحن يدوي",
    manualDesc: "حوّل المبلغ ثم أرفق الإثبات، وستُضاف القيمة بعد مراجعة الإدارة.",
    depositsTitle: "طلبات الشحن",
    noDeposits: "لا توجد طلبات شحن بعد.",
    date: "التاريخ",
    method: "الطريقة",
    amount: "المبلغ",
    status: "الحالة",
    note: "ملاحظة",
    history: "سجل الحركات",
  },
  en: {
    available: "Available balance",
    total: "Total balance",
    held: "Held for orders",
    title: "Wallet",
    subtitle: "Top up your balance and track every transaction.",
    binanceTitle: "Instant top-up — Binance Pay ⚡",
    binanceDesc:
      "Pay with your Binance wallet — funds are credited automatically once confirmed.",
    binanceDisabled:
      "Currently disabled — add Binance Pay keys in the server settings to enable it.",
    cryptoTitle: "Crypto top-up (BEP20)",
    cryptoDesc:
      "USDT / USDC / BUSD — your balance is credited automatically after network confirmation.",
    manualTitle: "Manual deposit request",
    manualDesc:
      "Transfer the amount and attach proof — funds are added after admin review.",
    depositsTitle: "Deposit requests",
    noDeposits: "No deposit requests yet.",
    date: "Date",
    method: "Method",
    amount: "Amount",
    status: "Status",
    note: "Note",
    history: "Transaction history",
  },
} as const;

export default async function WalletPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = T[locale];

  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, user.id))
    .limit(1);

  const txs = wallet
    ? await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.walletId, wallet.id))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(25)
    : [];

  const deposits = await db
    .select()
    .from(depositRequests)
    .where(eq(depositRequests.userId, user.id))
    .orderBy(desc(depositRequests.createdAt))
    .limit(10);

  const minDeposit = displayAmount(await getMinDeposit());
  const binanceEnabled = isBinanceEnabled();
  const cryptoConfig = await getCryptoConfig();
  const currency = await getSelectedCurrency();
  const activeBankAccounts = await listActiveBankAccounts();

  const balance = parseAmount(wallet?.balance ?? "0");
  const held = parseAmount(wallet?.heldBalance ?? "0");
  const available = balance - held;

  const stats = [
    {
      Icon: Coins,
      label: t.available,
      value: displayAmount(available, 2),
      highlight: true,
    },
    { Icon: WalletIcon, label: t.total, value: displayAmount(balance, 2) },
    { Icon: Lock, label: t.held, value: displayAmount(held, 2) },
  ];

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 pb-24 sm:pb-12 overflow-x-hidden">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted">{t.subtitle}</p>
        </div>

        {/* بطاقات الرصيد */}
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map(({ Icon, label, value, highlight }) => (
            <Card key={label} className="overflow-hidden">
              <CardContent className="flex items-center gap-4 p-5 sm:p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted">{label}</p>
                  <p
                    className={`text-xl sm:text-2xl font-extrabold truncate ${highlight ? "text-gradient-gold" : ""}`}
                    dir="ltr"
                  >
                    {value}$
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3 min-w-0">
          {/* طرق الشحن */}
          <div className="space-y-6 lg:col-span-1 min-w-0">
            <Card className="border-gold/30 overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">{t.binanceTitle}</CardTitle>
                <CardDescription className="break-words">{t.binanceDesc}</CardDescription>
              </CardHeader>
              <CardContent>
               {binanceEnabled && <BinanceDeposit minDeposit={minDeposit} />}
              </CardContent>
            </Card>

            {cryptoConfig.address && (
              <Card className="border-gold/30 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base">{t.cryptoTitle}</CardTitle>
                  <CardDescription className="break-words">{t.cryptoDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <CryptoDeposit
                    minDeposit={minDeposit}
                    currency={
                      currency
                        ? { label: currency.label, rate: currency.rate }
                        : null
                    }
                  />
                </CardContent>
              </Card>
            )}

            <div className="mb-6 min-w-0">
              <BankAccountsDisplay accounts={activeBankAccounts} />
            </div>

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">{t.manualTitle}</CardTitle>
                <CardDescription className="break-words">{t.manualDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <DepositForm
                  minDeposit={minDeposit}
                  currency={
                    currency
                      ? { label: currency.label, rate: currency.rate }
                      : null
                  }
                />
              </CardContent>
            </Card>
          </div>

          {/* طلبات الشحن السابقة */}
          <Card className="lg:col-span-2 min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">{t.depositsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {deposits.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
                  {t.noDeposits}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                        <th className="px-4 py-3 font-medium">{t.date}</th>
                        <th className="px-4 py-3 font-medium">{t.method}</th>
                        <th className="px-4 py-3 font-medium">{t.amount}</th>
                        <th className="px-4 py-3 font-medium">{t.status}</th>
                        <th className="px-4 py-3 font-medium">{t.note}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map((d) => {
                        const st = depositStatusLabel(d.status, locale);
                        const method = depositMethodLabel(d.method, locale);
                        return (
                          <tr key={d.id} className="border-b border-border/60 last:border-0">
                            <td className="whitespace-nowrap px-4 py-3 text-muted">
                              {formatDate(d.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={method.tone}>{method.label}</Badge>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold" dir="ltr">
                              {displayAmount(d.amount)}$
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={st.tone}>{st.label}</Badge>
                            </td>
                            <td className="max-w-[200px] truncate px-4 py-3 text-muted">
                              {d.rejectReason ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* سجل الحركات */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold">{t.history}</h2>
          <TxTable txs={txs} />
        </div>
      </main>
    </div>
  );
}
