import { Badge } from "@/components/ui/badge";
import { txTypeLabel } from "@/lib/labels";
import { displayAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { getLocale } from "@/server/locale";
import type { WalletTransaction } from "@/server/db/schema";

const T = {
  ar: {
    empty: "لا توجد حركات بعد.",
    date: "التاريخ",
    reference: "المرجع",
    type: "النوع",
    amount: "المبلغ",
    balanceAfter: "الرصيد بعد",
    note: "ملاحظة",
  },
  en: {
    empty: "No transactions yet.",
    date: "Date",
    reference: "Reference",
    type: "Type",
    amount: "Amount",
    balanceAfter: "Balance after",
    note: "Note",
  },
} as const;

/** جدول سجل حركات المحفظة (مكوّن خادمي مشترك: العميل + صفحة الأدمن). */
export async function TxTable({ txs }: { txs: WalletTransaction[] }) {
  const locale = await getLocale();
  const t = T[locale];
  if (txs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        {t.empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
            <th className="px-4 py-3 font-medium">{t.date}</th>
            <th className="px-4 py-3 font-medium">{t.reference}</th>
            <th className="px-4 py-3 font-medium">{t.type}</th>
            <th className="px-4 py-3 font-medium">{t.amount}</th>
            <th className="px-4 py-3 font-medium">{t.balanceAfter}</th>
            <th className="px-4 py-3 font-medium">{t.note}</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((tx) => {
            const type = txTypeLabel(tx.type, locale);
            const credit = tx.direction === "credit";
            return (
              <tr key={tx.id} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {formatDate(tx.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted" dir="ltr">
                  {tx.referenceNo}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={type.tone}>{type.label}</Badge>
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 font-semibold ${credit ? "text-success" : "text-danger"}`}
                  dir="ltr"
                >
                  {credit ? "+" : "−"}
                  {displayAmount(tx.amount)}$
                </td>
                <td className="whitespace-nowrap px-4 py-3" dir="ltr">
                  {displayAmount(tx.balanceAfter)}$
                </td>
                <td className="max-w-[220px] truncate px-4 py-3 text-muted">
                  {tx.reason ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
