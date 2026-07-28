import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { wallets } from "@/server/db/schema";

/**
 * مطابقة أرصدة المحافظ (Reconciliation): يعيد بناء balance وheld من مجموع
 * القيود ويقارنها ببطاقة الرصيد المخزّنة، ويكشف أي انحراف.
 *
 * قواعد إعادة البناء (مطابقة لنواة الدفتر):
 *   balance = Σ(deposit+refund+admin_credit + correction credit)
 *           − Σ(purchase+admin_debit + correction debit)
 *   held    = Σ(hold) − Σ(release) − Σ(purchase)
 *
 * عملية قراءة فقط — لا تعدّل شيئًا؛ للتشخيص والتنبيه.
 */

export interface WalletMismatch {
  walletId: string;
  userId: string;
  storedBalance: string;
  computedBalance: string;
  storedHeld: string;
  computedHeld: string;
}

export interface ReconcileResult {
  checked: number;
  mismatches: WalletMismatch[];
}

export async function reconcileAllWallets(): Promise<ReconcileResult> {
  const result = await db.execute(sql`
    WITH agg AS (
      SELECT
        w.id AS wallet_id,
        w.user_id,
        w.balance AS stored_balance,
        w.held_balance AS stored_held,
        COALESCE(SUM(
          CASE
            WHEN t.type IN ('deposit','refund','admin_credit') THEN t.amount
            WHEN t.type = 'correction' AND t.direction = 'credit' THEN t.amount
            WHEN t.type IN ('purchase','admin_debit') THEN -t.amount
            WHEN t.type = 'correction' AND t.direction = 'debit' THEN -t.amount
            ELSE 0
          END
        ), 0) AS computed_balance,
        COALESCE(SUM(
          CASE
            WHEN t.type = 'hold' THEN t.amount
            WHEN t.type IN ('release','purchase') THEN -t.amount
            ELSE 0
          END
        ), 0) AS computed_held
      FROM wallets w
      LEFT JOIN wallet_transactions t ON t.wallet_id = w.id
      GROUP BY w.id, w.user_id, w.balance, w.held_balance
    )
    SELECT * FROM agg
    WHERE stored_balance <> computed_balance OR stored_held <> computed_held
  `);

  // postgres-js عبر drizzle يعيد مصفوفة صفوف مباشرة.
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<
    Record<string, unknown>
  >;

  const mismatches: WalletMismatch[] = rows.map((r) => ({
    walletId: String(r.wallet_id),
    userId: String(r.user_id),
    storedBalance: String(r.stored_balance),
    computedBalance: String(r.computed_balance),
    storedHeld: String(r.stored_held),
    computedHeld: String(r.computed_held),
  }));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(wallets);

  return { checked: count ?? 0, mismatches };
}
