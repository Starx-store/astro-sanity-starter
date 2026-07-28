import Link from "next/link";
import { cookies } from "next/headers";
import { StoreLogo } from "@/components/brand/store-logo";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { CurrencySwitcher } from "@/components/store/currency-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getSessionUser } from "@/server/auth/session";
import { isStaffOrAdmin } from "@/server/auth/rbac";
import { getDisplayCurrencies, CURRENCY_COOKIE } from "@/server/currency";
import { getLocale } from "@/server/locale";
import { LangToggle } from "@/components/layout/lang-toggle";

const T = {
  ar: {
    products: "المنتجات",
    orders: "طلباتي",
    how: "كيف يعمل",
    support: "الدعم",
    admin: "لوحة التحكم",
    wallet: "المحفظة",
    account: "حسابي",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
  },
  en: {
    products: "Products",
    orders: "My Orders",
    how: "How it works",
    support: "Support",
    admin: "Dashboard",
    wallet: "Wallet",
    account: "Account",
    login: "Sign in",
    register: "Sign up",
  },
} as const;

export async function SiteHeader() {
  const user = await getSessionUser();
  const locale = await getLocale();
  const t = T[locale];
  const navLinks = [
    { href: "/products", label: t.products },
    { href: "/#how", label: t.how },
    { href: "/support", label: t.support },
  ];
  const links = user
    ? [navLinks[0], { href: "/orders", label: t.orders }, ...navLinks.slice(1)]
    : navLinks;
  const currencies = await getDisplayCurrencies();
  const selectedCurrency = (await cookies()).get(CURRENCY_COOKIE)?.value ?? "USD";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto hidden h-16 max-w-6xl items-center justify-between gap-4 px-4 md:flex">
        <Link href="/" aria-label="Evo Store">
          <StoreLogo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap text-base font-semibold text-foreground/80 transition-colors hover:text-gold"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LangToggle locale={locale} />
          <ThemeToggle />
          <CurrencySwitcher
            currencies={currencies.map((c) => ({ code: c.code, label: c.label }))}
            selected={selectedCurrency}
          />
          {user ? (
            <>
              {isStaffOrAdmin(user) && (
                <Link href="/admin" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    {t.admin}
                  </Button>
                </Link>
              )}
              <NotificationBell />
              <Link href="/wallet">
                <Button variant="outline" size="sm">
                  {t.wallet}
                </Button>
              </Link>
              <Link href="/account">
                <Button size="sm">{t.account}</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  {t.login}
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">{t.register}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
{/* أدوات الجوال */}
<div className="flex items-center justify-between gap-2 px-4 py-3 md:hidden">
  <Link href="/" aria-label="Evo Store">
    <StoreLogo />
  </Link>

  <div className="flex items-center gap-2">
    <LangToggle locale={locale} />
    <ThemeToggle />
    <CurrencySwitcher
      currencies={currencies.map((c) => ({
        code: c.code,
        label: c.label,
      }))}
      selected={selectedCurrency}
    />
  </div>
</div>

<div className="grid grid-cols-2 gap-2 border-t border-border/50 px-4 py-2 md:hidden">
  {user ? (
    <>
      <Link href="/wallet">
        <Button variant="outline" size="sm" className="w-full">
          {t.wallet}
        </Button>
      </Link>

      <Link href="/account">
        <Button size="sm" className="w-full">
          {t.account}
        </Button>
      </Link>

      {isStaffOrAdmin(user) && (
        <Link href="/admin" className="col-span-2">
          <Button
            variant="outline"
            size="sm"
            className="h-auto min-h-10 w-full whitespace-nowrap px-3 py-2 text-sm leading-normal"
          >
            {t.admin}
          </Button>
        </Link>
      )}
    </>
  ) : (
    <>
      <Link href="/login">
        <Button variant="ghost" size="sm" className="w-full">
          {t.login}
        </Button>
      </Link>

      <Link href="/register">
        <Button size="sm" className="w-full">
          {t.register}
        </Button>
      </Link>
    </>
  )}
</div>
      {/* روابط التنقّل على الجوال — صف ثانٍ بدل إخفائها كليًا. */}
      <nav className="flex items-center justify-center gap-6 overflow-x-auto border-t border-border/50 px-4 py-2 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap text-sm font-semibold text-foreground/80 transition-colors hover:text-gold"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
