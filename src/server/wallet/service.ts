import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  wallets,
  walletTransactions,
  auditLogs,
  notifications,
  users,
  type WalletTransaction,
} from "@/server/db/schema";
import { generateReferenceNo } from "@/server/auth/tokens";
import { WalletError } from "@/server/errors";
import { parseAmount, toDbAmount, displayAmount } from "@/lib/money";
import { sendWhatsAppNotification } from "@/server/notifications/whatsapp";

/**
 * نواة الدفتر المالي (Ledger).
 *
 * النموذج المحاسبي:
 * - balance      = إجمالي أموال المحفظة (متاح + محجوز).
 * - held_balance = المحجوز لطلبات قيد التنفيذ.
 * - المتاح       = balance − held_balance (مشتق، لا يُخزّن).
 *
 * أثر كل نوع قيد:
 * | النوع         | الاتجاه | balance | held  | الشرط                    |
 * |---------------|---------|---------|-------|--------------------------|
 * | deposit       | credit  | +amt    | —     | —                        |
 * | admin_credit  | credit  | +amt    | —     | —                        |
 * | refund        | credit  | +amt    | —     | (استرجاع بعد تسوية)      |
 * | admin_debit   | debit   | −amt    | —     | المتاح ≥ amt             |
 * | hold          | debit   | —       | +amt  | المتاح ≥ amt             |
 * | release       | credit  | —       | −amt  | المحجوز ≥ amt            |
 * | purchase      | debit   | −amt    | −amt  | المحجوز ≥ amt (تسوية حجز)|
 * | correction    | حسب الطلب| ±amt   | —     | عند الخصم: المتاح ≥ amt  |
 *
 * قواعد إعادة البناء (Reconciliation):
 * - balance = Σ(deposit+admin_credit+refund+correction↑) − Σ(admin_debit+purchase+correction↓)
 * - held    = Σ(hold) − Σ(release) − Σ(purchase)
 * - hold/release لا يغيّران balance؛ لذلك balance_before = balance_after فيهما،
 *   وتغيّر المحجوز/المتاح مسجّل في metadata.
 *
 * balance_before/balance_after يشيران دائمًا إلى wallets.balance، فتتكوّن سلسلة
 * متصلة عبر كل القيود (before(n) = after(n−1)) يمكن تدقيقها آليًا.
 */

export type LedgerType =
  | "deposit"
  | "purchase"
  | "refund"
  | "hold"
  | "release"
  | "admin_credit"
  | "admin_debit"
  | "correction";

export type LedgerSource =
  | "admin"
  | "deposit_request"
  | "binance"
  | "order"
  | "system";

export interface LedgerInput {
  userId: string;
  type: LedgerType;
  amount: string | number | bigint;
  source: LedgerSource;
  /** مطلوب لنوع correction فقط؛ يُتجاهل لبقية الأنواع. */
  direction?: "credit" | "debit";
  relatedOrderId?: string | null;
  relatedDepositId?: string | null;
  idempotencyKey?: string | null;
  performedBy?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface LedgerResult {
  entry: WalletTransaction;
  /** true إذا كان القيد موجودًا مسبقًا بنفس مفتاح idempotency (لم تُنفَّذ عملية جديدة). */
  replayed: boolean;
}

const DIRECTION_MAP: Record<Exclude<LedgerType, "correction">, "credit" | "debit"> = {
  deposit: "credit",
  admin_credit: "credit",
  refund: "credit",
  release: "credit",
  admin_debit: "debit",
  hold: "debit",
  purchase: "debit",
};

/** نوع منفّذ المعاملة داخل db.transaction (يُمرَّر للتركيب داخل معاملات أكبر). */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "23505"
  );
}

/**
 * كتابة قيد داخل معاملة قائمة (يُستخدم للتركيب: اعتماد إيداع، إنشاء طلب...).
 * يقفل صف المحفظة، يتحقق من الشروط، يكتب القيد، ويحدّث الأرصدة — ذريًّا.
 */
export async function postLedgerEntryInTx(
  tx: DbTx,
  input: LedgerInput,
): Promise<LedgerResult> {
  // 1) تحقق المبلغ
  let amt: bigint;
  try {
    amt = parseAmount(input.amount);
  } catch {
    throw new WalletError("invalid_amount", "المبلغ غير صالح.", 422);
  }
  if (amt <= 0n) {
    throw new WalletError("invalid_amount", "يجب أن يكون المبلغ أكبر من صفر.", 422);
  }

  const direction =
    input.type === "correction"
      ? input.direction
      : DIRECTION_MAP[input.type];
  if (!direction) {
    throw new WalletError(
      "direction_required",
      "قيد التصحيح يتطلب تحديد الاتجاه (credit/debit).",
      422,
    );
  }

  // 2) قفل صف المحفظة (تسلسل كامل لكل عمليات المستخدم المالية)
  const [wallet] = await tx
    .select()
    .from(wallets)
    .where(eq(wallets.userId, input.userId))
    .for("update");
  if (!wallet) {
    throw new WalletError("wallet_not_found", "المحفظة غير موجودة.", 404);
  }

  // 3) Idempotency: نفس المفتاح ⇒ إعادة القيد الموجود دون أي أثر جديد
  if (input.idempotencyKey) {
    const [existing] = await tx
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing) return { entry: existing, replayed: true };
  }

  // 4) حساب الأرصدة الجديدة (BigInt فقط)
  const balance = parseAmount(wallet.balance);
  const held = parseAmount(wallet.heldBalance);
  const available = balance - held;

  let newBalance = balance;
  let newHeld = held;

  const insufficientAvailable = () =>
    new WalletError(
      "insufficient_funds",
      `الرصيد المتاح غير كافٍ (المتاح: ${displayAmount(available)}).`,
      409,
    );

  switch (input.type) {
    case "deposit":
    case "admin_credit":
    case "refund":
      newBalance = balance + amt;
      break;
    case "admin_debit":
      if (available < amt) throw insufficientAvailable();
      newBalance = balance - amt;
      break;
    case "hold":
      if (available < amt) throw insufficientAvailable();
      newHeld = held + amt;
      break;
    case "release":
      if (held < amt) {
        throw new WalletError(
          "held_insufficient",
          "الرصيد المحجوز أقل من مبلغ فك الحجز.",
          409,
        );
      }
      newHeld = held - amt;
      break;
    case "purchase":
      if (held < amt) {
        throw new WalletError(
          "held_insufficient",
          "التسوية تتطلب حجزًا مساويًا للمبلغ.",
          409,
        );
      }
      newBalance = balance - amt;
      newHeld = held - amt;
      break;
    case "correction":
      if (direction === "credit") {
        newBalance = balance + amt;
      } else {
        if (available < amt) throw insufficientAvailable();
        newBalance = balance - amt;
      }
      break;
  }

  // 5) كتابة القيد ثم تحديث بطاقة الرصيد
  const [entry] = await tx
    .insert(walletTransactions)
    .values({
      referenceNo: generateReferenceNo("TXN"),
      walletId: wallet.id,
      type: input.type,
      direction,
      amount: toDbAmount(amt),
      balanceBefore: toDbAmount(balance),
      balanceAfter: toDbAmount(newBalance),
      status: "completed",
      source: input.source,
      relatedOrderId: input.relatedOrderId ?? null,
      relatedDepositId: input.relatedDepositId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      performedBy: input.performedBy ?? null,
      reason: input.reason ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        heldBefore: toDbAmount(held),
        heldAfter: toDbAmount(newHeld),
        availableBefore: toDbAmount(available),
        availableAfter: toDbAmount(newBalance - newHeld),
      },
    })
    .returning();

  await tx
    .update(wallets)
    .set({
      balance: toDbAmount(newBalance),
      heldBalance: toDbAmount(newHeld),
      version: sql`${wallets.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, wallet.id));

  // WhatsApp auto-notification for deposits
  if (input.type === "deposit" || input.type === "admin_credit") {
    setTimeout(async () => {
      try {
        const [u] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, input.userId)).limit(1);
        if (u?.phone) {
          await sendWhatsAppNotification({
            phone: u.phone,
            type: "deposit",
            text: `تم إضافة رصيد لمحفظتك بقيمة ${displayAmount(amt)}$ بنجاح!\nالرصيد المتاح الآن: ${displayAmount(newBalance - newHeld)}$`
          });
        }
      } catch (err) {
        console.error("WhatsApp deposit notification error:", err);
      }
    }, 100);
  }

  return { entry, replayed: false };
}

/**
 * كتابة قيد كمعاملة مستقلة، مع معالجة سباق idempotency
 * (طلبان متزامنان بنفس المفتاح: الثاني يعيد قيد الأول).
 */
export async function postLedgerEntry(input: LedgerInput): Promise<LedgerResult> {
  try {
    return await db.transaction((tx) => postLedgerEntryInTx(tx, input));
  } catch (e) {
    if (input.idempotencyKey && isUniqueViolation(e)) {
      const [existing] = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) return { entry: existing, replayed: true };
    }
    throw e;
  }
}

/**
 * تعديل إداري للرصيد (إضافة/خصم) مع تدقيق وإشعار — عملية ذرية واحدة.
 */
export async function adminAdjustWallet(params: {
  targetUserId: string;
  direction: "credit" | "debit";
  amount: string;
  reason: string;
  performedBy: string;
  ip?: string | null;
}): Promise<WalletTransaction> {
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, params.targetUserId))
    .limit(1);
  if (!target) {
    throw new WalletError("user_not_found", "المستخدم غير موجود.", 404);
  }

  return db.transaction(async (tx) => {
    const { entry } = await postLedgerEntryInTx(tx, {
      userId: params.targetUserId,
      type: params.direction === "credit" ? "admin_credit" : "admin_debit",
      amount: params.amount,
      source: "admin",
      performedBy: params.performedBy,
      reason: params.reason,
    });

    await tx.insert(auditLogs).values({
      actorId: params.performedBy,
      action: "wallet.adjust",
      entityType: "wallet_transaction",
      entityId: entry.id,
      after: {
        direction: params.direction,
        amount: entry.amount,
        reason: params.reason,
        targetUserId: params.targetUserId,
      },
      ip: params.ip ?? null,
    });

    await tx.insert(notifications).values({
      userId: params.targetUserId,
      type: "wallet_adjusted",
      title:
        params.direction === "credit"
          ? "تمت إضافة رصيد لمحفظتك"
          : "تم خصم رصيد من محفظتك",
      body: `${params.direction === "credit" ? "أُضيف" : "خُصم"} مبلغ ${displayAmount(entry.amount)}$ — ${params.reason}`,
      metadata: { transactionId: entry.id, referenceNo: entry.referenceNo },
    });

    return entry;
  });
}
