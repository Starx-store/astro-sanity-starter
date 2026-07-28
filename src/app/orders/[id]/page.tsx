import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowRight, PackageCheck } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import {
  orders,
  orderStatusHistory,
  orderMessages,
  products,
  productPackages,
} from "@/server/db/schema";
import { requiredFieldDefSchema } from "@/server/validation/catalog";
import { displayAmount } from "@/lib/money";
import { formatDate, isUuid } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/labels";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderMessages } from "@/components/orders/order-messages";
import { CancelOrderButton } from "@/components/orders/cancel-button";
import { getLocale } from "@/server/locale";

export const dynamic = "force-dynamic";

const T = {
  ar: {
    allOrders: "كل الطلبات",
    deliveryData: "بيانات التسليم",
    progress: "تقدّم التنفيذ",
    startCount: "العدد عند البدء",
    remains: "المتبقّي",
    orderDetails: "تفاصيل الطلب",
    pkg: "البكج",
    quantity: "الكمية",
    unitPrice: "سعر الوحدة",
    total: "الإجمالي",
    orderDate: "تاريخ الطلب",
    messages: "المراسلات",
    statusLog: "سجل الحالة",
  },
  en: {
    allOrders: "All orders",
    deliveryData: "Delivery Details",
    progress: "Order Progress",
    startCount: "Start count",
    remains: "Remaining",
    orderDetails: "Order Details",
    pkg: "Package",
    quantity: "Quantity",
    unitPrice: "Unit price",
    total: "Total",
    orderDate: "Order date",
    messages: "Messages",
    statusLog: "Status History",
  },
} as const;

export default async function OrderDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const user = await requireUser();
  const locale = await getLocale();
  const t = T[locale];
  if (!isUuid(params.id)) notFound();

  const [row] = await db
    .select({ o: orders, productName: products.name, requiredFields: products.requiredFields })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(and(eq(orders.id, params.id), eq(orders.userId, user.id)))
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

  const st = orderStatusLabel(order.status, locale);
  const inputData = (order.inputData ?? {}) as Record<string, string>;
  const delivery = (order.deliveryData ?? null) as {
    text?: string;
    startCount?: number | string | null;
    remains?: number | string | null;
  } | null;
  // تقدّم التنفيذ لدى المزوّد (يُحدَّث مع كل مزامنة) — بلا ذكر اسم المزوّد.
  const hasProgress =
    delivery != null &&
    (delivery.startCount != null || delivery.remains != null);
  const canCancel = ["under_review", "needs_info"].includes(order.status);
  const canMessage = !["completed", "refunded", "cancelled"].includes(order.status);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Link
          href="/orders"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          {t.allOrders}
        </Link>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
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
            {/* التسليم */}
            {order.status === "completed" && delivery?.text && (
              <Card className="border-success/40">
                <CardHeader className="flex-row items-center gap-3">
                  <PackageCheck className="h-5 w-5 text-success" />
                  <CardTitle className="text-base">{t.deliveryData}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line rounded-lg bg-surface-2/60 p-4 text-sm leading-relaxed">
                    {delivery.text}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* تقدّم التنفيذ */}
            {hasProgress && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t.progress}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {delivery?.startCount != null && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">{t.startCount}</span>
                      <span className="font-medium" dir="ltr">
                        {String(delivery.startCount)}
                      </span>
                    </div>
                  )}
                  {delivery?.remains != null && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">{t.remains}</span>
                      <span className="font-medium" dir="ltr">
                        {String(delivery.remains)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* تفاصيل الطلب */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.orderDetails}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {pkg && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">{t.pkg}</span>
                    <span className="font-medium">{pkg.name}</span>
                  </div>
                )}
                {order.quantity && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">{t.quantity}</span>
                    <span className="font-medium" dir="ltr">
                      {displayAmount(order.quantity)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-muted">{t.unitPrice}</span>
                  <span className="font-medium" dir="ltr">
                    {displayAmount(order.unitPrice)}$
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted">{t.total}</span>
                  <span className="font-extrabold text-gold" dir="ltr">
                    {displayAmount(order.totalPrice)}$
                  </span>
                </div>
                {Object.entries(inputData).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="text-muted">{labelOf(k)}</span>
                    <span className="max-w-[240px] break-all text-left font-medium" dir="auto">
                      {v}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between gap-4">
                  <span className="text-muted">{t.orderDate}</span>
                  <span className="font-medium">{formatDate(order.createdAt)}</span>
                </div>
              </CardContent>
            </Card>

            {/* المراسلات */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.messages}</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderMessages
                  orderId={order.id}
                  viewerIsStaff={false}
                  disabled={!canMessage}
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
            {/* الخط الزمني */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.statusLog}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-5 before:absolute before:right-[5px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-border">
                  {history.map((h) => {
                    const hs = orderStatusLabel(h.toStatus, locale);
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

            {canCancel && <CancelOrderButton orderId={order.id} />}
          </div>
        </div>
      </main>
    </div>
  );
}
