import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { orders, users } from "@/server/db/schema";
import { getSetting } from "@/server/settings/service";

/**
 * فئات العضوية (باقات) — تُحسب تلقائيًا من إجمالي مشتريات العميل المكتملة أو يعينها الأدمن.
 * برونزية (الافتراضي) → فضية (>100$) → ذهبية (>500$) → ماسية VIP (>1000$).
 * لكل فئة نسبة خصم يحددها الأدمن وتُطبّق على أسعار الطلبات.
 */

export type Tier = "bronze" | "silver" | "gold" | "platinum";

/** حدود الترقية التلقائية بالدولار (إجمالي المشتريات المكتملة). */
export const TIER_THRESHOLDS = { silver: 100, gold: 500, platinum: 1000 } as const;

export const TIER_META: Record<
  Tier,
  {
    label: string;
    labelEn: string;
    emoji: string;
    tone: "warning" | "neutral" | "gold";
  }
> = {
  bronze: { label: "برونزية", labelEn: "Bronze", emoji: "🥉", tone: "warning" },
  silver: { label: "فضية", labelEn: "Silver", emoji: "🥈", tone: "neutral" },
  gold: { label: "ذهبية", labelEn: "Gold", emoji: "🥇", tone: "gold" },
  platinum: { label: "ماسية VIP", labelEn: "Platinum VIP", emoji: "💎", tone: "gold" },
};

/** اسم الباقة بلغة الواجهة. */
export function tierLabel(tier: Tier, locale: "ar" | "en" = "ar"): string {
  return locale === "en" ? TIER_META[tier].labelEn : TIER_META[tier].label;
}

/** إجمالي إنفاق العميل (الطلبات المكتملة أو المكتملة جزئيًا). */
export async function getUserSpentUsd(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${orders.totalPrice}), 0)` })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        inArray(orders.status, ["completed", "partially_completed"]),
      ),
    );
  return Number(row?.total ?? 0) || 0;
}

export function resolveTier(spentUsd: number): Tier {
  if (spentUsd >= TIER_THRESHOLDS.platinum) return "platinum";
  if (spentUsd >= TIER_THRESHOLDS.gold) return "gold";
  if (spentUsd >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

/** نسب خصم الفئات كما يحددها الأدمن (٪). */
export async function getTierDiscounts(): Promise<Record<Tier, number>> {
  const clamp = (n: number) => Math.min(100, Math.max(0, n)) || 0;
  const silver = Number(await getSetting<number | string>("tiers.silver_discount", 3));
  const gold = Number(await getSetting<number | string>("tiers.gold_discount", 5));
  const platinum = Number(await getSetting<number | string>("tiers.platinum_discount", 10));
  return { bronze: 0, silver: clamp(silver), gold: clamp(gold), platinum: clamp(platinum) };
}

export interface TierInfo {
  spent: number;
  tier: Tier;
  discountPercent: number;
  discounts: Record<Tier, number>;
  nextTier: Tier | null;
  nextThreshold: number | null;
  remainingToNext: number | null;
}

export async function getUserTierInfo(userId: string): Promise<TierInfo> {
  const [u] = await db
    .select({ membershipTier: users.membershipTier, isTrader: users.isTrader })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const spent = await getUserSpentUsd(userId);
  let tier: Tier = resolveTier(spent);

  if (u?.membershipTier === "platinum") {
    tier = "platinum";
  } else if (u?.membershipTier === "gold") {
    tier = "gold";
  } else if (u?.membershipTier === "silver") {
    tier = "silver";
  }

  const discounts = await getTierDiscounts();
  let discountPercent = discounts[tier];

  if (u?.membershipTier === "platinum") discountPercent = discounts.platinum;
  else if (u?.membershipTier === "gold") discountPercent = discounts.gold;
  else if (u?.membershipTier === "silver") discountPercent = discounts.silver;

  let nextTier: Tier | null = null;
  let nextThreshold: number | null = null;
  if (tier === "bronze") {
    nextTier = "silver";
    nextThreshold = TIER_THRESHOLDS.silver;
  } else if (tier === "silver") {
    nextTier = "gold";
    nextThreshold = TIER_THRESHOLDS.gold;
  } else if (tier === "gold") {
    nextTier = "platinum";
    nextThreshold = TIER_THRESHOLDS.platinum;
  }

  return {
    spent,
    tier,
    discountPercent,
    discounts,
    nextTier,
    nextThreshold,
    remainingToNext:
      nextThreshold !== null ? Math.max(0, nextThreshold - spent) : null,
  };
}

/** خصم الفئة المطبّق على أسعار طلبات العميل (٪). */
export async function getUserOrderDiscountPercent(
  userId: string,
): Promise<number> {
  const [u] = await db
    .select({ membershipTier: users.membershipTier, isTrader: users.isTrader })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const silverDiscount = Number(await getSetting<number | string>("tiers.silver_discount", 3));
  const goldDiscount = Number(await getSetting<number | string>("tiers.gold_discount", 5));
  const platinumDiscount = Number(await getSetting<number | string>("tiers.platinum_discount", 10));

  if (u?.membershipTier === "platinum") return Math.min(100, Math.max(0, platinumDiscount));
  if (u?.membershipTier === "gold") return Math.min(100, Math.max(0, goldDiscount));
  if (u?.membershipTier === "silver") return Math.min(100, Math.max(0, silverDiscount));
  if (u?.membershipTier === "trader") return 0;

  const spent = await getUserSpentUsd(userId);
  const tier = resolveTier(spent);
  if (tier === "bronze") return 0;
  const discounts = await getTierDiscounts();
  return discounts[tier];
}
