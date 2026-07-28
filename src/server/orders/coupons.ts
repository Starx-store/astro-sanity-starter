import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { discountCodes, discountRedemptions } from "@/server/db/schema";
import type { DbTx } from "@/server/wallet/service";
import { AppError } from "@/server/errors";
import { parseAmount, applyPercentDiscount, displayAmount } from "@/lib/money";

/**
 * كوبونات الخصم.
 *
 * الخصم يُحسب على إجمالي الطلب بعد كل قواعد التسعير الأخرى. الاستخدام
 * يُسجَّل داخل نفس معاملة إنشاء الطلب، مع:
 *  - زيادة العدّاد شرطيًا (لا يتجاوز الحد الأقصى ولو تزامنت الطلبات)،
 *  - فهرس فريد على order_id يمنع احتساب كوبونين لطلب واحد،
 *  - فحص حد الاستخدام لكل عميل.
 */

export interface CouponPreview {
  codeId: string;
  code: string;
  amountOff: bigint;
  newTotal: bigint;
}

/** يتحقق من الكوبون ويحسب الخصم — بلا أي تعديل في القاعدة. */
export async function previewCoupon(params: {
  code: string;
  userId: string;
  total: bigint;
}): Promise<CouponPreview> {
  const code = params.code.trim().toUpperCase();
  if (!code) throw new AppError("coupon_required", "أدخل رمز الكوبون.", 422);

  const [row] = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.code, code))
    .limit(1);

  const invalid = () =>
    new AppError("coupon_invalid", "رمز الكوبون غير صالح.", 422, {
      couponCode: "رمز غير صالح",
    });

  if (!row || !row.isActive) throw invalid();

  const now = new Date();
  if (row.startsAt && row.startsAt > now) {
    throw new AppError("coupon_not_started", "هذا الكوبون لم يبدأ بعد.", 422);
  }
  if (row.endsAt && row.endsAt < now) {
    throw new AppError("coupon_expired", "انتهت صلاحية هذا الكوبون.", 422);
  }
  if (row.maxUses != null && row.usedCount >= row.maxUses) {
    throw new AppError("coupon_exhausted", "استُنفد هذا الكوبون.", 422);
  }
  if (row.minAmount && params.total < parseAmount(row.minAmount)) {
    throw new AppError(
      "coupon_min_amount",
      `هذا الكوبون يتطلب طلبًا بقيمة ${displayAmount(row.minAmount)}$ على الأقل.`,
      422,
    );
  }

  // حد الاستخدام لكل عميل.
  if (row.perUserLimit != null) {
    const [used] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(discountRedemptions)
      .where(
        and(
          eq(discountRedemptions.codeId, row.id),
          eq(discountRedemptions.userId, params.userId),
        ),
      );
    if ((used?.n ?? 0) >= row.perUserLimit) {
      throw new AppError(
        "coupon_user_limit",
        "استخدمت هذا الكوبون بالحد المسموح.",
        422,
      );
    }
  }

  // حساب الخصم.
  let newTotal: bigint;
  if (row.type === "percent") {
    newTotal = applyPercentDiscount(params.total, Number(row.value));
  } else {
    const off = parseAmount(String(row.value));
    newTotal = params.total > off ? params.total - off : 0n;
  }
  if (newTotal < 0n) newTotal = 0n;
  const amountOff = params.total - newTotal;
  if (amountOff <= 0n) {
    throw new AppError("coupon_no_effect", "لا ينطبق هذا الكوبون على طلبك.", 422);
  }
  // لا نسمح بطلب مجاني تمامًا (يمنعه دفتر المحفظة أيضًا).
  if (newTotal <= 0n) {
    throw new AppError(
      "coupon_no_effect",
      "قيمة الكوبون تغطي الطلب بالكامل — تواصل مع الدعم.",
      422,
    );
  }

  return { codeId: row.id, code: row.code, amountOff, newTotal };
}

/**
 * تسجيل استخدام الكوبون داخل معاملة إنشاء الطلب.
 * زيادة العدّاد شرطية فلا يتجاوز الحد الأقصى تحت التزامن.
 */
export async function redeemCouponInTx(
  tx: DbTx,
  params: {
    codeId: string;
    userId: string;
    orderId: string;
    amountOff: bigint;
  },
): Promise<void> {
  // تحديث شرطي يقفل صف الكوبون — كل استخدامات هذا الكوبون تتسلسل عليه،
  // فنعيد التحقق من النافذة الزمنية والحدود داخل القفل لا خارجه.
  const updated = await tx
    .update(discountCodes)
    .set({ usedCount: sql`${discountCodes.usedCount} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(discountCodes.id, params.codeId),
        eq(discountCodes.isActive, true),
        sql`(${discountCodes.maxUses} IS NULL OR ${discountCodes.usedCount} < ${discountCodes.maxUses})`,
        sql`(${discountCodes.startsAt} IS NULL OR ${discountCodes.startsAt} <= now())`,
        sql`(${discountCodes.endsAt} IS NULL OR ${discountCodes.endsAt} > now())`,
      ),
    )
    .returning({
      id: discountCodes.id,
      perUserLimit: discountCodes.perUserLimit,
    });

  if (updated.length === 0) {
    throw new AppError("coupon_exhausted", "استُنفد هذا الكوبون أو انتهت صلاحيته.", 409);
  }

  // حد الاستخدام لكل عميل يُفحص هنا (بعد القفل) لا في المعاينة — وإلا تجاوزته
  // الطلبات المتزامنة لأن كلًّا منها يقرأ العدّاد قبل أن يلتزم الآخر.
  const limit = updated[0].perUserLimit;
  if (limit != null) {
    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(discountRedemptions)
      .where(
        and(
          eq(discountRedemptions.codeId, params.codeId),
          eq(discountRedemptions.userId, params.userId),
        ),
      );
    if ((used?.n ?? 0) >= limit) {
      throw new AppError(
        "coupon_user_limit",
        "استخدمت هذا الكوبون بالحد المسموح.",
        409,
      );
    }
  }

  await tx.insert(discountRedemptions).values({
    codeId: params.codeId,
    userId: params.userId,
    orderId: params.orderId,
    amountOff: displayAmount(params.amountOff),
  });
}
