import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { orders, products } from "@/server/db/schema";
import { displayAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/labels";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/server/locale";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    title: "طلباتي",
    subtitle: "تابع حالة طلباتك خطوة بخطوة.",
    browse: "تصفح المنتجات",
    empty: "لا توجد طلبات بعد.",
    startFirst: "ابدأ أول طلب",
    thOrderNo: "رقم الطلب",
    thProduct: "المنتج",
    thTotal: "الإجمالي",
    thStatus: "الحالة",
    thDate: "التاريخ",
    details: "التفاصيل",
  },
  en: {
    title: "My Orders",
    subtitle: "Track your orders every step of the way.",
    browse: "Browse products",
    empty: "No orders yet.",
    startFirst: "Place your first order",
    thOrderNo: "Order no.",
    thProduct: "Product",
    thTotal: "Total",
    thStatus: "Status",
    thDate: "Date",
    details: "Details",
  },
} as const;

export default async function OrdersPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = T[locale];

  const rows = await db
    .select({ o: orders, productName: products.name })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <p className="text-sm text-muted">{t.subtitle}</p>
          </div>
          <Link href="/products">
            <Button size="sm" variant="outline">
              {t.browse}
            </Button>
          </Link>
        </div>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted">{t.empty}</p>
              <Link href="/products" className="mt-4 inline-block">
                <Button>{t.startFirst}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* عرض الجوال (بطاقات أنيقة) */}
            <div className="space-y-3 sm:hidden">
              {rows.map(({ o, productName }) => {
                const st = orderStatusLabel(o.status, locale);
                return (
                  <Card key={o.id} className="p-4 border border-border bg-surface shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <span className="font-mono text-xs font-bold text-gold" dir="ltr">
                        #{o.orderNo}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="font-bold text-foreground">{productName}</p>
                      <div className="flex items-center justify-between text-xs text-muted pt-1">
                        <span>{formatDate(o.createdAt)}</span>
                        <span className="font-extrabold text-foreground text-sm" dir="ltr">{displayAmount(o.totalPrice)}$</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/40 text-left">
                      <Link href={`/orders/${o.id}`} className="text-xs font-semibold text-gold hover:underline">
                        {t.details} ←
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* عرض الشاشات المتوسطة والكبيرة (جدول) */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-2/60 text-right text-xs text-muted">
                        <th className="px-4 py-3 font-medium">{t.thOrderNo}</th>
                        <th className="px-4 py-3 font-medium">{t.thProduct}</th>
                        <th className="px-4 py-3 font-medium">{t.thTotal}</th>
                        <th className="px-4 py-3 font-medium">{t.thStatus}</th>
                        <th className="px-4 py-3 font-medium">{t.thDate}</th>
                        <th className="px-4 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ o, productName }) => {
                        const st = orderStatusLabel(o.status, locale);
                        return (
                          <tr key={o.id} className="border-b border-border/60 last:border-0">
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs" dir="ltr">
                              {o.orderNo}
                            </td>
                            <td className="px-4 py-3 font-medium">{productName}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold" dir="ltr">
                              {displayAmount(o.totalPrice)}$
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={st.tone}>{st.label}</Badge>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                              {formatDate(o.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/orders/${o.id}`}
                                className="text-sm font-medium text-gold hover:underline"
                              >
                                {t.details}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
