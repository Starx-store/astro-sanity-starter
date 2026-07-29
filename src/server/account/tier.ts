import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { orders, users } from "@/server/db/schema";
import { getSetting } from "@/server/settings/service";

/**
 * فئات العضوية (باقات) — تُحسب تلقائيًا من إجمالي مشتريات العميل المكتملة.
 * برونزية (الافتراضي) → فضية (>100$) → ذهبية (>500$).
 * لكل فئة نسبة خصم يحددها الأدمن وتُطبّق على أسعار الطلبات.
 */

export type Tier = "bronze" | "silver" | "gold";

/** حدود الترقية بالدولار (إجمالي المشتريات المكتملة). */
export const TIER_THRESHOLDS = { silver: 100, gold: 500 } as const;

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
  if (spentUsd >= TIER_THRESHOLDS.gold) return "gold";
  if (spentUsd >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

/** نسب خصم الفئات كما يحددها الأدمن (٪). */
export async function getTierDiscounts(): Promise<Record<Tier, number>> {
  const clamp = (n: number) => Math.min(100, Math.max(0, n)) || 0;
  const silver = Number(await getSetting<number | string>("tiers.silver_discount", 0));
  const gold = Number(await getSetting<number | string>("tiers.gold_discount", 0));
  return { bronze: 0, silver: clamp(silver), gold: clamp(gold) };
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
  const spent = await getUserSpentUsd(userId);
  const tier = resolveTier(spent);
  const discounts = await getTierDiscounts();

  let nextTier: Tier | null = null;
  let nextThreshold: number | null = null;
  if (tier === "bronze") {
    nextTier = "silver";
    nextThreshold = TIER_THRESHOLDS.silver;
  } else if (tier === "silver") {
    nextTier = "gold";
    nextThreshold = TIER_THRESHOLDS.gold;
  }

  return {
    spent,
    tier,
    discountPercent: discounts[tier],
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

  if (u?.membershipTier === "trader") return 0;
  if (u?.membershipTier === "platinum") return 10;
  if (u?.membershipTier === "gold") return 5;
  if (u?.membershipTier === "silver") return 3;

  const spent = await getUserSpentUsd(userId);
  const tier = resolveTier(spent);
  if (tier === "bronze") return 0;
  const discounts = await getTierDiscounts();
  return discounts[tier];
}
