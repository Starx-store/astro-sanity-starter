import Link from "next/link";
import { eq } from "drizzle-orm";
import { Wallet, ShieldAlert, LayoutDashboard, Crown } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { wallets } from "@/server/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { TwoFactorManager } from "@/components/account/two-factor-manager";
import { formatMoney } from "@/lib/utils";
import { isStaffOrAdmin } from "@/server/auth/rbac";
import { getUserTierInfo, TIER_META, tierLabel } from "@/server/account/tier";
import { getLocale } from "@/server/locale";
import { ReferralCard } from "@/components/account/referral-card";
import { ApiKeyCard } from "@/components/account/api-key-card";
import { ensureReferralCode } from "@/server/referrals/service";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    roleCustomer: "عميل",
    roleStaff: "موظف",
    roleAdmin: "مدير",
    hello: (name: string) => `مرحبًا، ${name}`,
    verifyNote: "بريدك غير مؤكّد بعد — أكّده لتأمين حسابك واستلام رسائل الطلبات.",
    verifyBtn: "تأكيد البريد",
    walletBalance: "رصيد المحفظة",
    totals: (total: string, held: string) =>
      `الإجمالي: ${total} — المحجوز: ${held}`,
    manageWallet: "إدارة المحفظة وشحن الرصيد",
    myOrders: "طلباتي",
    support: "الدعم",
    account: "الحساب",
    status: "الحالة",
    active: "نشط",
    role: "الدور",
    tier: "الباقة",
    traderBadge: "🏆 التاجر",
    membership: "باقة العضوية",
    traderActive: "🏆 باقة التاجر مفعّلة",
    traderDesc: "تشتري بالأسعار الخاصة بالتجار حيثما حُدّدت.",
    tierName: (label: string) => `الباقة ${label}`,
    totalSpent: "إجمالي مشترياتك:",
    discount: (p: number) => `خصم دائم ${p}% على طلباتك`,
    noDiscount: "لا يوجد خصم لهذه الباقة بعد",
    progressTo: (label: string, emoji: string) =>
      `التقدّم إلى الباقة ${label} ${emoji}`,
    remainingPrefix: "تبقّى",
    remainingSuffix: (label: string) =>
      `من المشتريات للترقية إلى الباقة ${label}.`,
    topTier: "🎉 وصلت لأعلى باقة — تستمتع بأفضل الخصومات.",
    adminPanel: "لوحة التحكم",
    adminDesc: "لديك صلاحية الوصول للإدارة.",
    openPanel: "فتح اللوحة",
    twoFactor: "المصادقة الثنائية (2FA)",
  },
  en: {
    roleCustomer: "Customer",
    roleStaff: "Staff",
    roleAdmin: "Admin",
    hello: (name: string) => `Welcome, ${name}`,
    verifyNote:
      "Your email isn't verified yet — verify it to secure your account and receive order updates.",
    verifyBtn: "Verify email",
    walletBalance: "Wallet Balance",
    totals: (total: string, held: string) =>
      `Total: ${total} — On hold: ${held}`,
    manageWallet: "Manage wallet & top up",
    myOrders: "My Orders",
    support: "Support",
    account: "Account",
    status: "Status",
    active: "Active",
    role: "Role",
    tier: "Tier",
    traderBadge: "🏆 Trader",
    membership: "Membership Tier",
    traderActive: "🏆 Trader plan active",
    traderDesc: "You get trader pricing wherever it's available.",
    tierName: (label: string) => `${label} tier`,
    totalSpent: "Total purchases:",
    discount: (p: number) => `Permanent ${p}% discount on your orders`,
    noDiscount: "No discount at this tier yet",
    progressTo: (label: string, emoji: string) =>
      `Progress to the ${label} tier ${emoji}`,
    remainingPrefix: "Only",
    remainingSuffix: (label: string) =>
      `more in purchases to reach the ${label} tier.`,
    topTier: "🎉 You've reached the top tier — enjoy the best discounts.",
    adminPanel: "Dashboard",
    adminDesc: "You have admin access.",
    openPanel: "Open dashboard",
    twoFactor: "Two-Factor Authentication (2FA)",
  },
} as const;

export default async function AccountPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = T[locale];
  const roleLabel: Record<string, string> = {
    customer: t.roleCustomer,
    staff: t.roleStaff,
    admin: t.roleAdmin,
  };
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, user.id))
    .limit(1);

  await ensureReferralCode(user.id);

  const available = wallet
    ? (Number(wallet.balance) - Number(wallet.heldBalance)).toFixed(2)
    : "0.00";

  const tierInfo = await getUserTierInfo(user.id);
  const tier = TIER_META[tierInfo.tier];
  const progress =
    tierInfo.nextThreshold && tierInfo.nextThreshold > 0
      ? Math.min(100, Math.round((tierInfo.spent / tierInfo.nextThreshold) * 100))
      : 100;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t.hello(user.name)}</h1>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
          <LogoutButton />
        </div>

        {!user.emailVerifiedAt && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p className="text-sm">{t.verifyNote}</p>
            <Link href="/verify">
              <Button size="sm" variant="outline">
                {t.verifyBtn}
              </Button>
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{t.walletBalance}</CardTitle>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold/10 text-gold">
                <Wallet className="h-5 w-5" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-gradient-gold">
                {formatMoney(available, wallet?.currency ?? "USD")}
              </div>
              <p className="mt-1 text-xs text-muted">
                {t.totals(
                  formatMoney(wallet?.balance ?? "0", wallet?.currency ?? "USD"),
                  formatMoney(wallet?.heldBalance ?? "0", wallet?.currency ?? "USD"),
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/wallet">
                  <Button size="sm" variant="outline">
                    {t.manageWallet}
                  </Button>
                </Link>
                <Link href="/orders">
                  <Button size="sm" variant="ghost">
                    {t.myOrders}
                  </Button>
                </Link>
                <Link href="/support">
                  <Button size="sm" variant="ghost">
                    {t.support}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.account}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">{t.status}</span>
                <Badge tone={user.status === "active" ? "success" : "warning"}>
                  {user.status === "active" ? t.active : user.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">{t.role}</span>
                <Badge tone="gold">{roleLabel[user.role] ?? user.role}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">{t.tier}</span>
                {user.isTrader ? (
                  <Badge tone="gold">{t.traderBadge}</Badge>
                ) : (
                  <Badge tone={tier.tone}>
                    {tier.emoji} {tierLabel(tierInfo.tier, locale)}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* باقة العضوية والترقية */}
        <Card className="mt-4 border-gold/30">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{t.membership}</CardTitle>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold/10 text-gold">
              <Crown className="h-5 w-5" />
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.isTrader && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold/10 p-3">
                <p className="font-bold">{t.traderActive}</p>
                <p className="text-xs text-muted">{t.traderDesc}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tier.emoji}</span>
                <div>
                  <p className="font-bold">{t.tierName(tierLabel(tierInfo.tier, locale))}</p>
                  <p className="text-xs text-muted">
                    {t.totalSpent}{" "}
                    <span dir="ltr">${tierInfo.spent.toFixed(2)}</span>
                  </p>
                </div>
              </div>
              {tierInfo.discountPercent > 0 ? (
                <Badge tone="success">
                  {t.discount(tierInfo.discountPercent)}
                </Badge>
              ) : (
                <Badge tone="neutral">{t.noDiscount}</Badge>
              )}
            </div>

            {tierInfo.nextTier ? (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted">
                  <span>
                    {t.progressTo(
                      tierLabel(tierInfo.nextTier, locale),
                      TIER_META[tierInfo.nextTier].emoji,
                    )}
                  </span>
                  <span dir="ltr">
                    ${tierInfo.spent.toFixed(0)} / ${tierInfo.nextThreshold}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gold transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {t.remainingPrefix}{" "}
                  <span dir="ltr">${(tierInfo.remainingToNext ?? 0).toFixed(2)}</span>{" "}
                  {t.remainingSuffix(tierLabel(tierInfo.nextTier, locale))}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">{t.topTier}</p>
            )}
          </CardContent>
        </Card>

        <div className="mt-4">
          <ReferralCard />
        </div>

        {isStaffOrAdmin(user) && (
          <Card className="mt-4 border-gold/30">
            <CardContent className="flex items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold/10 text-gold">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{t.adminPanel}</p>
                  <p className="text-sm text-muted">{t.adminDesc}</p>
                </div>
              </div>
              <Link href="/admin">
                <Button size="sm">
                  <LayoutDashboard className="h-4 w-4" />
                  {t.openPanel}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">{t.twoFactor}</CardTitle>
          </CardHeader>
          <CardContent>
            <TwoFactorManager enabled={!!user.twoFactorEnabled} />
          </CardContent>
        </Card>

        <div className="mt-4">
          <ApiKeyCard />
        </div>
      </main>
    </div>
  );
}
