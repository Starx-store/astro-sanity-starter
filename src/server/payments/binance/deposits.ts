import "server-only";
import { and, eq } from "drizzle-orm";
import { randomBytes, randomUUID } from "crypto";
import { db } from "@/server/db";
import {
  depositRequests,
  notifications,
  type DepositRequest,
} from "@/server/db/schema";
import { AppError, WalletError } from "@/server/errors";
import { parseAmount, toDbAmount, displayAmount } from "@/lib/money";
import { postLedgerEntryInTx } from "@/server/wallet/service";
import { getMinDeposit } from "@/server/wallet/deposits";
import {
  createBinanceOrder,
  queryBinanceOrder,
  isBinanceEnabled,
  type BinanceOrderCreated,
} from "./client";

/**
 * تدفق الإيداع التلقائي عبر Binance Pay.
 *
 * ضمانات عدم الازدواج (متعددة الطبقات):
 * 1. مفتاح idempotency حتمي على قيد المحفظة: `binance-deposit-<depositId>` —
 *    نفس المفتاح سواء وصل الاعتماد من Webhook أو من زر «تحديث الحالة»، فلا يتكرر أبدًا.
 * 2. قفل صف الإيداع FOR UPDATE + فحص الحالة قبل الإضافة.
 * 3. علم فريد على payment_events (provider, external_id, event_type) ضد تكرار الإشعارات.
 */

/** معرّف تاجر فريد — أحرف وأرقام فقط (متوافق مع قيود Binance، ≤ 32). */
export function generateMerchantTradeNo(): string {
  return `EVO${Date.now().toString(36).toUpperCase()}${randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;
}

export async function createBinanceDeposit(params: {
  userId: string;
  amount: string;
}): Promise<{ deposit: DepositRequest; pay: BinanceOrderCreated }> {
  if (!isBinanceEnabled()) {
    throw new AppError(
      "binance_disabled",
      "الدفع عبر Binance Pay غير مفعّل حاليًا.",
      503,
    );
  }

  const amt = parseAmount(params.amount);
  const min = await getMinDeposit();
  if (amt < min) {
    throw new WalletError(
      "below_minimum",
      `الحد الأدنى للشحن هو ${displayAmount(min)}$.`,
      422,
      { amount: `الحد الأدنى ${displayAmount(min)}$` },
    );
  }

  const merchantTradeNo = generateMerchantTradeNo();

  // ننشئ السجل أولًا حتى لا يوجد دفع لدى Binance بلا أثر عندنا.
  const [deposit] = await db
    .insert(depositRequests)
    .values({
      userId: params.userId,
      method: "binance",
      amount: toDbAmount(amt),
      currency: "USD",
      status: "pending",
      externalId: merchantTradeNo,
      externalStatus: "INITIAL",
      idempotencyKey: randomUUID(),
    })
    .returning();

  try {
    const pay = await createBinanceOrder({
      merchantTradeNo,
      amount: displayAmount(amt),
      description: "Evo Store wallet deposit",
    });
    await db
      .update(depositRequests)
      .set({ externalStatus: "PENDING", updatedAt: new Date() })
      .where(eq(depositRequests.id, deposit.id));
    return { deposit, pay };
  } catch (e) {
    // فشل إنشاء الأمر لدى Binance ⇒ أغلق الطلب المحلي
    await db
      .update(depositRequests)
      .set({
        status: "expired",
        externalStatus: "CREATE_FAILED",
        updatedAt: new Date(),
      })
      .where(eq(depositRequests.id, deposit.id));
    throw e;
  }
}

/**
 * اعتماد إيداع Binance وإضافة الرصيد — ذري وقابل للتكرار بأمان.
 * يُستدعى من الـ Webhook ومن زر التحقق اليدوي بنفس المفتاح.
 * يعيد true إذا كان الإيداع معروفًا (سواء أُضيف الآن أو كان مضافًا).
 */
export async function creditBinanceDeposit(params: {
  merchantTradeNo: string;
  transactionId?: string | null;
  via: "webhook" | "poll";
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [deposit] = await tx
      .select()
      .from(depositRequests)
      .where(
        and(
          eq(depositRequests.externalId, params.merchantTradeNo),
          eq(depositRequests.method, "binance"),
        ),
      )
      .for("update");

    if (!deposit) {
      console.error(
        `[binance] إشعار دفع لمعاملة غير معروفة: ${params.merchantTradeNo}`,
      );
      return false;
    }
    if (deposit.status === "completed") return true; // معالج مسبقًا

    const { entry } = await postLedgerEntryInTx(tx, {
      userId: deposit.userId,
      type: "deposit",
      amount: deposit.amount,
      source: "binance",
      relatedDepositId: deposit.id,
      idempotencyKey: `binance-deposit-${deposit.id}`,
      reason: "شحن تلقائي عبر Binance Pay",
      metadata: {
        merchantTradeNo: params.merchantTradeNo,
        transactionId: params.transactionId ?? null,
        via: params.via,
      },
    });

    await tx
      .update(depositRequests)
      .set({
        status: "completed",
        externalStatus: "PAID",
        walletTransactionId: entry.id,
        updatedAt: new Date(),
      })
      .where(eq(depositRequests.id, deposit.id));

    await tx.insert(notifications).values({
      userId: deposit.userId,
      type: "deposit_completed",
      title: "تم شحن محفظتك ⚡",
      body: `وصل دفعك عبر Binance Pay وأُضيف ${displayAmount(deposit.amount)}$ إلى رصيدك.`,
      metadata: { depositId: deposit.id, via: params.via },
    });

    return true;
  });
}

/** إنهاء إيداع Binance غير المدفوع (أُغلق/انتهى لدى Binance). */
export async function expireBinanceDeposit(
  merchantTradeNo: string,
  externalStatus = "CLOSED",
): Promise<void> {
  await db
    .update(depositRequests)
    .set({ status: "expired", externalStatus, updatedAt: new Date() })
    .where(
      and(
        eq(depositRequests.externalId, merchantTradeNo),
        eq(depositRequests.method, "binance"),
        eq(depositRequests.status, "pending"),
      ),
    );
}

/**
 * تحقق يدوي من حالة الدفع (Polling) — أساسي أثناء التطوير المحلي
 * حيث لا تصل Webhooks إلى localhost، ويستخدم نفس مسار الاعتماد الذري.
 */
export async function checkBinanceDeposit(params: {
  depositId: string;
  userId: string;
}): Promise<{ status: "completed" | "pending" | "expired"; externalStatus: string }> {
  const [deposit] = await db
    .select()
    .from(depositRequests)
    .where(eq(depositRequests.id, params.depositId))
    .limit(1);

  if (
    !deposit ||
    deposit.userId !== params.userId ||
    deposit.method !== "binance" ||
    !deposit.externalId
  ) {
    throw new AppError("not_found", "طلب الإيداع غير موجود.", 404);
  }

  if (deposit.status === "completed") {
    return { status: "completed", externalStatus: "PAID" };
  }

  const info = await queryBinanceOrder(deposit.externalId);

  if (info.status === "PAID") {
    await creditBinanceDeposit({
      merchantTradeNo: deposit.externalId,
      transactionId: info.transactionId ?? null,
      via: "poll",
    });
    return { status: "completed", externalStatus: "PAID" };
  }

  if (["EXPIRED", "CANCELED", "ERROR"].includes(info.status)) {
    await expireBinanceDeposit(deposit.externalId, info.status);
    return { status: "expired", externalStatus: info.status };
  }

  await db
    .update(depositRequests)
    .set({ externalStatus: info.status, updatedAt: new Date() })
    .where(eq(depositRequests.id, deposit.id));

  return { status: "pending", externalStatus: info.status };
}
