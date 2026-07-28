import Link from "next/link";
import { requireRole } from "@/server/auth/current-user";
import { hasPermission, PERMISSIONS, type Permission } from "@/server/auth/rbac";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/** كل تبويب مربوط بصلاحيته — لا نعرض للموظف ما لا يستطيع فتحه. */
const tabs: Array<{ href: string; label: string; permission?: Permission }> = [
  { href: "/admin", label: "نظرة عامة" },
  { href: "/admin/orders", label: "الطلبات", permission: PERMISSIONS.ordersManage },
  { href: "/admin/deposits", label: "الإيداعات", permission: PERMISSIONS.depositsReview },
  { href: "/admin/products", label: "المنتجات", permission: PERMISSIONS.productsEdit },
  { href: "/admin/categories", label: "التصنيفات", permission: PERMISSIONS.productsEdit },
  { href: "/admin/providers", label: "المزوّدون", permission: PERMISSIONS.providersManage },
  { href: "/admin/coupons", label: "الكوبونات", permission: PERMISSIONS.settingsEdit },
  { href: "/admin/bank-accounts", label: "الحسابات البنكية", permission: PERMISSIONS.settingsEdit },
  { href: "/admin/support", label: "الدعم", permission: PERMISSIONS.supportManage },
  { href: "/admin/users", label: "المستخدمون", permission: PERMISSIONS.usersManage },
  { href: "/admin/settings", label: "الإعدادات", permission: PERMISSIONS.settingsEdit },
];

/**
 * تخطيط لوحة الإدارة — يفرض دور staff/admin عبر قاعدة البيانات.
 * (Middleware يمنع مبدئيًا من لا يملك كوكي جلسة.)
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["admin", "staff"]);
  const visibleTabs = (
    await Promise.all(
      tabs.map(async (t) =>
        !t.permission || (await hasPermission(user, t.permission)) ? t : null,
      ),
    )
  ).filter((t): t is (typeof tabs)[number] => t !== null);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Logo />
            </Link>
            <Badge tone="gold">لوحة التحكم</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {user.name} · {user.role}
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
       <nav className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-3 md:flex md:gap-1 md:overflow-x-auto md:py-0">
  {visibleTabs.map((t) => (
    <Link
      key={t.href}
      href={t.href}
      className="flex min-h-10 items-center justify-center rounded-lg border border-border px-2 py-2 text-center text-xs font-medium leading-tight text-muted transition-colors hover:border-gold/50 hover:text-foreground sm:text-sm md:min-h-0 md:shrink-0 md:whitespace-nowrap md:rounded-none md:border-x-0 md:border-t-0 md:border-b-2 md:border-b-transparent md:px-3 md:py-3"
    >
      {t.label}
    </Link>
  ))}
</nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
