import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  users,
  wallets,
  walletTransactions,
  products,
  productPackages,
} from "@/server/db/schema";
import { requireRole, requirePagePermission } from "@/server/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/server/auth/rbac";
import { parseAmount, displayAmount } from "@/lib/money";
import { formatDate, isUuid } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WalletAdjustForm } from "@/components/admin/wallet-adjust-form";
import { TraderToggle } from "@/components/admin/trader-toggle";
import { CustomerPrices } from "@/components/admin/customer-prices";
import { StaffPermissions } from "@/components/admin/staff-permissions";
import { TxTable } from "@/components/wallet/tx-table";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const viewer = await requirePagePermission(PERMISSIONS.usersManage);
  if (!isUuid(params.id)) notFound();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, params.id))
    .limit(1);
  if (!user) notFound();

  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, user.id))
    .limit(1);

  const txs = wallet
    ? await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.walletId, wallet.id))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(15)
    : [];

  const canAdjust = await hasPermission(viewer, PERMISSIONS.walletAdjust);
  const canManageUsers = await hasPermission(viewer, PERMISSIONS.usersManage);

  // خيارات المنتجات للأسعار الخاصة (مع بكجاتها).
  const allProducts = await db
    .select({ id: products.id, name: products.name, type: products.type })
    .from(products)
    .orderBy(desc(products.createdAt))
    .limit(200);
  const allPackages = await db
    .select({
      id: productPackages.id,
      productId: productPackages.productId,
      name: productPackages.name,
    })
    .from(productPackages);
  const productOptions = allProducts.map((p) => ({
    ...p,
    packages: allPackages
      .filter((pk) => pk.productId === p.id)
      .map((pk) => ({ id: pk.id, name: pk.name })),
  }));

  const balance = parseAmount(wallet?.balance ?? "0");
  const held = parseAmount(wallet?.heldBalance ?? "0");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-muted" dir="ltr">
            {user.email}
          </p>
        </div>
        <div className="flex gap-2">
          {user.isTrader && <Badge tone="gold">🏆 تاجر</Badge>}
          <Badge tone={user.role === "customer" ? "neutral" : "gold"}>
            {user.role}
          </Badge>
          <Badge tone={user.status === "active" ? "success" : "danger"}>
            {user.status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ملخص المحفظة */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted">المتاح</p>
                <p className="text-xl font-extrabold text-gradient-gold" dir="ltr">
                  {displayAmount(balance - held)}$
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted">الإجمالي</p>
                <p className="text-xl font-extrabold" dir="ltr">
                  {displayAmount(balance)}$
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted">المحجوز</p>
                <p className="text-xl font-extrabold" dir="ltr">
                  {displayAmount(held)}$
                </p>
              </CardContent>
            </Card>
          </div>

          {/* آخر الحركات */}
          <div>
            <h2 className="mb-3 text-lg font-bold">آخر الحركات</h2>
            <TxTable txs={txs} />
          </div>
        </div>

        {/* تعديل الرصيد */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">باقة التاجر</CardTitle>
              <CardDescription>
                أسعار خاصة تُحدد داخل كل منتج — ليست نسبة خصم.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TraderToggle userId={user.id} isTrader={user.isTrader} />
            </CardContent>
          </Card>

          {viewer.role === "admin" && user.role !== "admin" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">الدور والصلاحيات</CardTitle>
                <CardDescription>
                  حوّله لموظف وحدّد بالضبط ما يستطيع فعله.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StaffPermissions userId={user.id} />
              </CardContent>
            </Card>
          )}

          {canManageUsers && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">أسعار خاصة بالعميل</CardTitle>
                <CardDescription>
                  سعر لمنتج معيّن يخص هذا العميل وحده.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomerPrices
                  userId={user.id}
                  productOptions={productOptions}
                />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تعديل الرصيد</CardTitle>
              <CardDescription>
                كل عملية تُنشئ قيدًا دائمًا في السجل مع إشعار للمستخدم.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!wallet ? (
                <p className="text-sm text-muted">لا توجد محفظة لهذا المستخدم.</p>
              ) : canAdjust ? (
                <WalletAdjustForm userId={user.id} />
              ) : (
                <p className="text-sm text-muted">
                  تحتاج صلاحية <code>wallet.adjust</code> لتعديل الرصيد.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
