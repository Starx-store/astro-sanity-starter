import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users, referrals, referralEarnings, orders, notifications } from "@/server/db/schema";
import { parseAmount, toDbAmount, displayAmount } from "@/lib/money";
import { getSetting } from "@/server/settings/service";
import { postLedgerEntryInTx } from "@/server/wallet/service";
import { sendWhatsAppNotification } from "@/server/notifications/whatsapp";

function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function generateReferralCode(): Promise<string> {
  let code = "";
  let isUnique = false;
  while (!isUnique) {
    code = randomString(8);
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, code))
      .limit(1);
    if (existing.length === 0) {
      isUnique = true;
    }
  }
  return code;
}

export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { referralCode: true },
  });
  
  if (user?.referralCode) {
    return user.referralCode;
  }
  
  const code = await generateReferralCode();
  await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
  return code;
}

export async function findUserByReferralCode(code: string) {
  if (!code) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.referralCode, code.toUpperCase()),
  });
  return user || null;
}

export async function linkReferral(referrerId: string, referredId: string): Promise<void> {
  await db.insert(referrals).values({
    referrerId,
    referredId,
  }).onConflictDoNothing({ target: referrals.referredId });
}

export async function getReferralStats(userId: string) {
  // Get all users referred by this user
  const refs = await db
    .select({
      referredName: users.name,
      referredEmail: users.email,
      referredCreatedAt: users.createdAt,
      referralId: referrals.id,
      referredId: referrals.referredId,
    })
    .from(referrals)
    .innerJoin(users, eq(referrals.referredId, users.id))
    .where(eq(referrals.referrerId, userId));

  // Get earnings grouped by referral
  const rawEarnings = await db
    .select({
      referralId: referralEarnings.referralId,
      total: sql<string>`coalesce(sum(${referralEarnings.commissionAmount}), '0')`,
    })
    .from(referralEarnings)
    .innerJoin(referrals, eq(referralEarnings.referralId, referrals.id))
    .where(eq(referrals.referrerId, userId))
    .groupBy(referralEarnings.referralId);

  const earningsMap = new Map(rawEarnings.map((r) => [r.referralId, r.total || "0"]));

  let totalEarnings = 0n;
  for (const amount of earningsMap.values()) {
    totalEarnings += parseAmount(amount);
  }

  return {
    totalReferred: refs.length,
    totalEarnings: displayAmount(totalEarnings),
    referrals: refs.map((r) => ({
      name: r.referredName,
      email: r.referredEmail,
      joinedAt: r.referredCreatedAt,
      totalEarnings: displayAmount(earningsMap.get(r.referralId) || "0"),
    })),
  };
}

export async function getTraderReferralCode(): Promise<string | null> {
  const code = await getSetting("referral.trader_code");
  return code ? String(code) : null;
}

export async function processReferralCommission(orderId: string): Promise<void> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: { id: true, userId: true, totalPrice: true, costPrice: true, status: true },
  });

  if (!order || order.status !== "completed") return;

  const referral = await db.query.referrals.findFirst({
    where: eq(referrals.referredId, order.userId),
  });

  if (!referral) return;

  const total = parseAmount(order.totalPrice);
  const cost = parseAmount(order.costPrice);
  const profit = total > cost ? total - cost : 0n;

  if (profit <= 0n) return;

  // 2.5% of profit = profit * 250 / 10000 (with rounding)
  const commission = (profit * 250n + 5000n) / 10000n;

  if (commission <= 0n) return;

  const commissionStr = toDbAmount(commission);
  const profitStr = toDbAmount(profit);

  try {
    await db.transaction(async (tx) => {
      // Create earning record using correct schema columns
      const [earning] = await tx.insert(referralEarnings).values({
        referralId: referral.id,
        orderId: order.id,
        orderAmount: order.totalPrice,
        costAmount: order.costPrice,
        profitAmount: profitStr,
        commissionRate: "0.0250",
        commissionAmount: commissionStr,
      }).onConflictDoNothing().returning();

      if (!earning) return; // already processed (idempotent via orderUq)

      // Credit referrer's wallet
      await postLedgerEntryInTx(tx, {
        userId: referral.referrerId,
        type: "admin_credit",
        amount: commissionStr,
        source: "system",
        reason: "عمولة إحالة",
        idempotencyKey: `ref-earn-${orderId}`,
        relatedOrderId: order.id,
      });

      await tx.insert(notifications).values({
        userId: referral.referrerId,
        type: "referral_commission",
        title: "عمولة إحالة جديدة",
        body: `لقد حصلت على عمولة إحالة بقيمة ${displayAmount(commissionStr)}$`,
        channel: "in_app",
      });
      
      // WhatsApp notification
      setTimeout(async () => {
        try {
          const [u] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, referral.referrerId)).limit(1);
          if (u?.phone) {
            await sendWhatsAppNotification({
              phone: u.phone,
              type: "referral",
              text: `مبروك! 🎉 حصلت على عمولة إحالة بقيمة ${displayAmount(commissionStr)}$ تمت إضافتها إلى محفظتك.`
            });
          }
        } catch (err) {
          console.error("WhatsApp referral commission notification error:", err);
        }
      }, 100);
    });
  } catch (e) {
    console.error("Failed to process referral commission for order", orderId, e);
  }
}

