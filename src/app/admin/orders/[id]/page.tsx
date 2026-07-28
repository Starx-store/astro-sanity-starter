import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { z } from "zod";
import { db } from "@/server/db";
import {
  orders,
  orderStatusHistory,
  orderMessages,
  products,
  productPackages,
  users,
} from "@/server/db/schema";
import { requiredFieldDefSchema } from "@/server/validation/catalog";
import { displayAmount, parseAmount } from "@/lib/money";
import { formatDate, isUuid } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderActions } from "@/components/admin/order-actions";
import { OrderSyncButtons } from "@/components/admin/order-sync-buttons";
import { OrderMessages } from "@/components/orders/order-messages";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  await requirePagePermission(PERMISSIONS.ordersManage);

  if (!isUuid(params.id)) notFound();

  const [row] = await db
    .select({
      o: orders,
      productName: products.name,
      requiredFields: products.requiredFields,
      userName: users.name,
      userEmail: users.email,
      userId: users.id,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, params.id))
    .limit(1);
  if (!row) notFound();
  const order = row.o;

  const [pkg] = order.packageId
    ? await db
        .select({ name: productPackages.name })
        .from(productPackages)
        .where(eq(productPackages.id, order.packageId))
        .limit(1)
    : [];

  const history = await db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, order.id))
    .orderBy(asc(orderStatusHistory.createdAt));

  const messages = await db
    .select()
    .from(orderMessages)
    .where(eq(orderMessages.orderId, order.id))
    .orderBy(asc(orderMessages.createdAt));

  const defs = z.array(requiredFieldDefSchema).safeParse(row.requiredFields);
  const labelOf = (key: string) =>
    (defs.success ? defs.data.find((d) => d.key === key)?.label : null) ?? key;

  const st = orderStatusLabel(order.status);
  const inputData = (order.inputData ?? {}) as Record<string, string>;
  const delivery = (order.deliveryData ?? null) as { text?: string } | null;
  const profit = parseAmount(order.totalPrice) - parseAmount(order.costPrice);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        كل الطلبات
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{row.productName}</h1>
          <p className="mt-1 font-mono text-xs text-muted" dir="ltr">
            {order.orderNo}
          </p>
        </div>
        <Badge tone={st.tone} className="px-3 py-1 text-sm">
          {st.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* العميل والمالية */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">العميل</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <Link
                  href={`/admin/users/${row.userId}`}
                  className="font-semibold text-gold hover:underline"
                >
                  {row.userName}
                </Link>
                <p className="mt-1 text-xs text-muted" dir="ltr">
                  {row.userEmail}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">المالية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">الإجمالي</span>
                  <span className="font-bold" dir="ltr">
                    {displayAmount(order.totalPrice)}$
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">التكلفة</span>
                  <span dir="ltr">{displayAmount(order.costPrice)}$</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">الربح</span>
                  <span className="font-bold text-success" dir="ltr">
                    {displayAmount(profit)}$
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* تفاصيل الطلب */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">بيانات الطلب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pkg && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted">البكج</span>
                  <span className="font-medium">{pkg.name}</span>
                </div>
              )}
              {order.quantity && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted">الكمية</span>
                  <span className="font-medium" dir="ltr">
                    {displayAmount(order.quantity)}
                  </span>
                </div>
              )}
              {Object.entries(inputData).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-muted">{labelOf(k)}</span>
                  <span className="max-w-[280px] break-all text-left font-medium" dir="auto">
                    {v}
                  </span>
                </div>
              ))}
              {delivery?.text && (
                <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-success">
                    التسليم المُرسل للعميل
                  </p>
                  <p className="whitespace-pre-line text-sm">{delivery.text}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* المراسلات */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">المراسلات مع العميل</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderMessages
                orderId={order.id}
                viewerIsStaff
                messages={messages.map((m) => ({
                  id: m.id,
                  sender: m.sender,
                  body: m.body,
                  createdAt: formatDate(m.createdAt),
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* الإجراءات */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الإجراءات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.fulfillment === "automatic" && (
                <div className="space-y-2 rounded-lg border border-gold/30 bg-gold/5 p-3">
                  <p className="text-xs text-muted">
                    تنفيذ تلقائي
                    {order.externalOrderId ? (
                      <>
                        {" "}· مرجع المزوّد{" "}
                        <span className="font-mono" dir="ltr">
                          {order.externalOrderId}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <OrderSyncButtons orderId={order.id} status={order.status} />
                </div>
              )}
              <OrderActions orderId={order.id} status={order.status} />
            </CardContent>
          </Card>

          {/* الخط الزمني */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">سجل الحالة</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 before:absolute before:right-[5px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-border">
                {history.map((h) => {
                  const hs = orderStatusLabel(h.toStatus);
                  return (
                    <li key={h.id} className="relative pr-5">
                      <span className="absolute right-0 top-1.5 h-2.5 w-2.5 rounded-full bg-gold" />
                      <p className="text-sm font-semibold">{hs.label}</p>
                      {h.note && <p className="text-xs text-muted">{h.note}</p>}
                      <p className="mt-0.5 text-[11px] text-muted">
                        {formatDate(h.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
