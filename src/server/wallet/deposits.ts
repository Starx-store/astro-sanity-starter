import "server-only";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import {
  depositRequests,
  notifications,
  auditLogs,
  settings,
  type DepositRequest,
} from "@/server/db/schema";
import { WalletError } from "@/server/errors";
import { parseAmount, toDbAmount, displayAmount } from "@/lib/money";
import { saveAttachment } from "@/server/storage";
import { notifyAdmin } from "@/server/email";
import { postLedgerEntryInTx } from "./service";

/** الحد الأدنى للشحن من إعدادات المتجر (افتراضي 1). */
export async function getMinDeposit(): Promise<bigint> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "store.min_deposit"))
    .limit(1);
  try {
    return parseAmount(String(row?.value ?? "1"));
  } catch {
    return parseAmount("1");
  }
}

/**
 * إنشاء طلب شحن يدوي من العميل مع إثبات التحويل.
 * لا يُضاف أي رصيد هنا — الرصيد يُضاف فقط عند اعتماد الأدمن.
 */
export async function createDepositRequest(params: {
  userId: string;
  amount: string;
  proof: { buffer: Buffer; mime: string; fileName: string | null };
}): Promise<DepositRequest> {
  const amt = parseAmount(params.amount);
  const min = await getMinDeposit();
  if (amt < min) {
    throw new WalletError(
      "below_minimum",
      `الحد الأدنى للشحن هو ${displayAmount(min)}$.`,
      422,
    );
  }

  const attachment = await saveAttachment({
    ownerId: params.userId,
    buffer: params.proof.buffer,
    mime: params.proof.mime,
    fileName: params.proof.fileName,
  });

  const [deposit] = await db
    .insert(depositRequests)
    .values({
      userId: params.userId,
      method: "manual_customer",
      amount: toDbAmount(amt),
      currency: "USD",
      status: "pending",
      proofFileId: attachment.id,
      idempotencyKey: randomUUID(),
    })
    .returning();

  // إشعار صاحب المتجر بطلب الشحن الجديد ليراجعه.
  await notifyAdmin("طلب شحن جديد بانتظار المراجعة 💰", [
    ["المبلغ", `${displayAmount(amt)}$`],
    ["الطريقة", "تحويل يدوي بإثبات"],
  ]);

  return deposit;
}

/**
 * مراجعة الأدمن لطلب الشحن — اعتماد (بقيد deposit ذري) أو رفض بسبب.
 * محمي من التكرار بثلاث طبقات: قفل صف الطلب، فحص الحالة pending،
 * ومفتاح idempotency حتمي `deposit-approve-<id>` على القيد.
 */
export async function reviewDeposit(params: {
  depositId: string;
  reviewerId: string;
  action: "approve" | "reject";
  reason?: string | null;
  ip?: string | null;
}): Promise<{ status: "completed" | "rejected" }> {
  return db.transaction(async (tx) => {
    const [deposit] = await tx
      .select()
      .from(depositRequests)
      .where(eq(depositRequests.id, params.depositId))
      .for("update");

    if (!deposit) {
      throw new WalletError("deposit_not_found", "طلب الشحن غير موجود.", 404);
    }
    if (deposit.method === "binance") {
      // منع الازدواج: اعتماد Binance يتم حصريًا عبر Webhook/التحقق التلقائي
      // بمفتاح idempotency مختلف — المراجعة اليدوية هنا ممنوعة.
      throw new WalletError(
        "binance_auto",
        "إيداعات Binance Pay تُعالج تلقائيًا ولا تُراجع يدويًا.",
        409,
      );
    }
    if (deposit.method === "crypto" && params.action === "approve") {
      // الاعتماد اليدوي لشحن الكريبتو ممنوع: التحقق يتم من البلوكتشين حصريًا.
      // بدونه يستطيع من يملك صلاحية المراجعة إضافة رصيد بلا أي دفع، كما يبقى
      // رقم المعاملة غير مُستهلك فيُعاد استخدامه لاحقًا.
      throw new WalletError(
        "crypto_auto",
        "شحن العملات الرقمية يُعتمد تلقائيًا بعد التحقق من الشبكة — لا يُعتمد يدويًا. يمكنك رفضه فقط.",
        409,
      );
    }
    if (deposit.status !== "pending") {
      throw new WalletError(
        "already_reviewed",
        "تمت مراجعة هذا الطلب مسبقًا.",
        409,
      );
    }

    if (params.action === "approve") {
      const { entry } = await postLedgerEntryInTx(tx, {
        userId: deposit.userId,
        type: "deposit",
        amount: deposit.amount,
        source: "deposit_request",
        relatedDepositId: deposit.id,
        idempotencyKey: `deposit-approve-${deposit.id}`,
        performedBy: params.reviewerId,
        reason: params.reason?.trim() || "اعتماد طلب شحن يدوي",
      });

      await tx
        .update(depositRequests)
        .set({
          status: "completed",
          reviewedBy: params.reviewerId,
          walletTransactionId: entry.id,
          updatedAt: new Date(),
        })
        .where(eq(depositRequests.id, deposit.id));

      await tx.insert(notifications).values({
        userId: deposit.userId,
        type: "deposit_approved",
        title: "تم شحن محفظتك",
        body: `تم اعتماد طلب الشحن وإضافة ${displayAmount(deposit.amount)}$ إلى رصيدك.`,
        metadata: { depositId: deposit.id, transactionId: entry.id },
      });

      await tx.insert(auditLogs).values({
        actorId: params.reviewerId,
        action: "deposit.approve",
        entityType: "deposit_request",
        entityId: deposit.id,
        before: { status: "pending" },
        after: { status: "completed", amount: deposit.amount, transactionId: entry.id },
        ip: params.ip ?? null,
      });

      return { status: "completed" as const };
    }

    // رفض
    const reason = params.reason?.trim();
    if (!reason) {
      throw new WalletError("reason_required", "سبب الرفض مطلوب.", 422);
    }

    await tx
      .update(depositRequests)
      .set({
        status: "rejected",
        reviewedBy: params.reviewerId,
        rejectReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(depositRequests.id, deposit.id));

    await tx.insert(notifications).values({
      userId: deposit.userId,
      type: "deposit_rejected",
      title: "تم رفض طلب الشحن",
      body: `عذرًا، رُفض طلب شحن ${displayAmount(deposit.amount)}$ — السبب: ${reason}`,
      metadata: { depositId: deposit.id },
    });

    await tx.insert(auditLogs).values({
      actorId: params.reviewerId,
      action: "deposit.reject",
      entityType: "deposit_request",
      entityId: deposit.id,
      before: { status: "pending" },
      after: { status: "rejected", reason },
      ip: params.ip ?? null,
    });

    return { status: "rejected" as const };
  });
}
