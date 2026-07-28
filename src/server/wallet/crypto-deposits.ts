import "server-only";
import { randomInt, randomUUID } from "crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { depositRequests, type DepositRequest } from "@/server/db/schema";
import { WalletError, isPgError } from "@/server/errors";
import { parseAmount, toDbAmount, displayAmount } from "@/lib/money";
import { getSetting } from "@/server/settings/service";
import { postLedgerEntryInTx } from "@/server/wallet/service";
import { verifyBep20Transfer } from "@/server/payments/crypto/bsc";
import { notifyAdmin } from "@/server/email";
import { getMinDeposit } from "./deposits";

/**
 * شحن المحفظة بعملة رقمية (BEP20) — تلقائي بالكامل وبلا حساب تاجر.
 *
 * كيف نمنع انتحال معاملة شخص آخر؟
 * أرقام المعاملات علنية، لذلك لا نكتفي بوجود المعاملة:
 *   1) لكل طلب شحن مبلغ فريد بكسور دقيقة (مثل 10.03471) لا يتكرر بين
 *      الطلبات المعلّقة، ويجب أن يطابق المبلغ على السلسلة تمامًا؛
 *   2) يجب أن يكون الطلب موجودًا قبل المعاملة (نطابق طلب المستخدم نفسه)؛
 *   3) رقم المعاملة فريد على مستوى المتجر (فهرس فريد) فلا يُستخدم مرتين.
 * بهذا لا ينفع لصٌّ ينسخ رقم معاملة غيره: لا يملك طلبًا معلّقًا بنفس
 * المبلغ الفريد، والمعاملة نفسها لا تُقبل مرتين.
 */

export interface CryptoDepositConfig {
  address: string | null;
  network: string;
  minConfirmations: number;
}

export async function getCryptoConfig(): Promise<CryptoDepositConfig> {
  const address = String(
    (await getSetting<string>("crypto.bep20_address", "")) ?? "",
  ).trim();
  const conf = Number(await getSetting<number>("crypto.min_confirmations", 6));
  return {
    address: /^0x[0-9a-fA-F]{40}$/.test(address) ? address : null,
    network: "BEP20",
    minConfirmations: Number.isFinite(conf) && conf > 0 ? conf : 6,
  };
}

/**
 * إنشاء طلب شحن كريبتو: يثبّت مبلغًا فريدًا يدفعه العميل بالضبط.
 * لا يُضاف رصيد هنا — يُضاف بعد التحقق من السلسلة.
 */
export async function createCryptoDeposit(params: {
  userId: string;
  amount: string;
}): Promise<{ deposit: DepositRequest; config: CryptoDepositConfig }> {
  const config = await getCryptoConfig();
  if (!config.address) {
    throw new WalletError(
      "crypto_disabled",
      "الشحن بالعملات الرقمية غير مفعّل حاليًا.",
      503,
    );
  }

  const base = parseAmount(params.amount);
  const min = await getMinDeposit();
  if (base < min) {
    throw new WalletError(
      "below_minimum",
      `الحد الأدنى للشحن هو ${displayAmount(min)}$.`,
      422,
    );
  }

  // مبلغ فريد بأربع خانات عشرية فقط (خطوة 0.0001 وحتى 0.0499) — رقم قصير
  // يسهل نسخه في تطبيق المحفظة، والفرق أقل من خمسة سنتات.
  //
  // التصادم يُفحص ضد الطلبات المعلّقة فقط: منع إعادة استخدام معاملة قديمة
  // مضمون بالفهرس الفريد على tx_hash، لا بحجز المبلغ للأبد — فلا داعي
  // لإهدار مساحة المبالغ (وهو ما كان يدفعنا لكسور طويلة).
  const STEP = 10_000n; // 0.0001 بمقياس 8
  for (let attempt = 0; attempt < 24; attempt++) {
    const unique = base + BigInt(randomInt(1, 500)) * STEP;
    const [clash] = await db
      .select({ id: depositRequests.id })
      .from(depositRequests)
      .where(
        and(
          eq(depositRequests.method, "crypto"),
          eq(depositRequests.status, "pending"),
          eq(depositRequests.amount, toDbAmount(unique)),
        ),
      )
      .limit(1);
    if (clash) continue;

    const [deposit] = await db
      .insert(depositRequests)
      .values({
        userId: params.userId,
        method: "crypto",
        amount: toDbAmount(unique),
        currency: "USD",
        status: "pending",
        network: config.network,
        idempotencyKey: randomUUID(),
      })
      .returning();
    return { deposit, config };
  }

  throw new WalletError(
    "amount_busy",
    "تعذّر تخصيص مبلغ فريد — جرّب مبلغًا مختلفًا قليلًا.",
    409,
  );
}

/**
 * التحقق من معاملة وإضافة الرصيد — كل الفحوص على السلسلة، بلا تدخل يدوي.
 */
/**
 * إنهاء طلبات الكريبتو المعلّقة القديمة (تُستدعى من الكرون) — يحرّر مبالغها
 * الفريدة لطلبات جديدة. المهلة سخية كي لا يتضرر من حوّل متأخرًا.
 */
export async function expireStaleCryptoDeposits(
  olderThanDays = 7,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 3600_000);
  const rows = await db
    .update(depositRequests)
    .set({
      status: "rejected",
      rejectReason: "انتهت مهلة طلب الشحن — أنشئ طلبًا جديدًا.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(depositRequests.method, "crypto"),
        eq(depositRequests.status, "pending"),
        lt(depositRequests.createdAt, cutoff),
      ),
    )
    .returning({ id: depositRequests.id });
  return rows.length;
}

export async function verifyCryptoDeposit(params: {
  userId: string;
  depositId: string;
  txHash: string;
}): Promise<{ credited: boolean; amount: string }> {
  const config = await getCryptoConfig();
  if (!config.address) {
    throw new WalletError("crypto_disabled", "الشحن بالعملات الرقمية معطّل.", 503);
  }

  const [deposit] = await db
    .select()
    .from(depositRequests)
    .where(
      and(
        eq(depositRequests.id, params.depositId),
        eq(depositRequests.userId, params.userId),
      ),
    )
    .limit(1);
  if (!deposit) {
    throw new WalletError("deposit_not_found", "طلب الشحن غير موجود.", 404);
  }
  if (deposit.status !== "pending") {
    throw new WalletError("already_reviewed", "هذا الطلب عولج مسبقًا.", 409);
  }

  // 1) قراءة المعاملة من البلوكتشين والتحقق من المستلم والتأكيدات.
  const transfer = await verifyBep20Transfer({
    txHash: params.txHash,
    toAddress: config.address,
    minConfirmations: config.minConfirmations,
  });

  // 2) المبلغ يجب أن يطابق المبلغ الفريد المخصّص لهذا الطلب تمامًا.
  const expected = parseAmount(deposit.amount);
  if (transfer.amount !== expected) {
    throw new WalletError(
      "amount_mismatch",
      `المبلغ المُحوَّل (${displayAmount(transfer.amount)}) لا يطابق المطلوب (${displayAmount(expected)}) — حوِّل المبلغ بالضبط كما هو معروض.`,
      422,
    );
  }

  // 3) الاعتماد داخل معاملة، مع فهرس فريد على رقم المعاملة يمنع أي تكرار.
  try {
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(depositRequests)
        .where(eq(depositRequests.id, deposit.id))
        .for("update");
      if (!locked || locked.status !== "pending") {
        throw new WalletError("already_reviewed", "هذا الطلب عولج مسبقًا.", 409);
      }

      const { entry } = await postLedgerEntryInTx(tx, {
        userId: deposit.userId,
        type: "deposit",
        amount: deposit.amount,
        source: "deposit_request",
        relatedDepositId: deposit.id,
        idempotencyKey: `deposit-crypto-${deposit.id}`,
        reason: `شحن ${transfer.token} عبر ${config.network}`,
      });

      await tx
        .update(depositRequests)
        .set({
          status: "completed",
          txHash: params.txHash.trim().toLowerCase(),
          externalStatus: transfer.token,
          confirmations: transfer.confirmations,
          walletTransactionId: entry.id,
          updatedAt: new Date(),
        })
        .where(eq(depositRequests.id, deposit.id));

      return { credited: true, amount: displayAmount(deposit.amount) };
    }).then(async (r) => {
      // إشعار صاحب المتجر بشحن كريبتو ناجح.
      await notifyAdmin("شحن بعملة رقمية ✅", [
        ["المبلغ", `${r.amount}$`],
        ["العملة", transfer.token],
        ["الشبكة", config.network],
      ]);
      return r;
    });
  } catch (e) {
    if (isPgError(e, "23505")) {
      throw new WalletError(
        "tx_already_used",
        "رقم المعاملة هذا مستخدم مسبقًا في شحن آخر.",
        409,
      );
    }
    throw e;
  }
}
