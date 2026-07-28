import "server-only";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/server/db";
import {
  orders,
  orderStatusHistory,
  notifications,
  providers,
  productPackages,
  type Order,
} from "@/server/db/schema";
import { postLedgerEntryInTx, type DbTx } from "@/server/wallet/service";
import { AppError } from "@/server/errors";
import { getAdapter } from "./adapters";
import { sendWhatsAppNotification } from "@/server/notifications/whatsapp";
import { users } from "@/server/db/schema";
import {
  buildContext,
  getProviderLinkForProduct,
  logApiCall,
} from "./service";
import { processReferralCommission } from "@/server/referrals/service";

/**
 * التنفيذ التلقائي عبر المزوّدين.
 *
 * فصل صارم بين الشبكة والمعاملات:
 * - الحجز يتم عند إنشاء الطلب (خدمة الطلبات) خارج هذه الوحدة.
 * - استدعاء المزوّد (شبكة) يتم خارج أي معاملة قاعدة بيانات.
 * - تحديث الحالة والتسوية/الاسترجاع داخل معاملة قصيرة.
 *
 * الأمان المالي: التسوية والاسترجاع يستخدمان نفس مفاتيح idempotency
 * (order-settle-<id> / order-release-<id>) المستخدمة في المسار اليدوي،
 * فيستحيل الخصم أو الاسترجاع مرتين حتى لو تزامنت المتابعة مع تدخل الأدمن.
 */

const POLLABLE: Order["status"][] = ["sent_to_provider", "in_progress"];

async function settleAutoTx(
  tx: DbTx,
  order: Order,
  deliveryData: Record<string, unknown> | null,
): Promise<void> {
  const { entry } = await postLedgerEntryInTx(tx, {
    userId: order.userId,
    type: "purchase",
    amount: order.totalPrice,
    source: "order",
    relatedOrderId: order.id,
    idempotencyKey: `order-settle-${order.id}`,
    reason: `تسوية الطلب ${order.orderNo} (تلقائي)`,
  });
  await tx
    .update(orders)
    .set({
      status: "completed",
      settleTransactionId: entry.id,
      deliveryData: deliveryData ?? order.deliveryData,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: "completed",
    note: "اكتمل تنفيذ طلبك",
  });
  await tx.insert(notifications).values({
    userId: order.userId,
    type: "order_completed",
    title: "اكتمل طلبك 🎉",
    body: `تم تنفيذ طلبك ${order.orderNo} — افتح الطلب للاطلاع على التسليم.`,
    metadata: { orderId: order.id, orderNo: order.orderNo },
  });

  // Actually, wait. We can't await it here if we want it outside transaction. But wait, JS promises:
  // We can just trigger it asynchronously or it will run inside the tx and use its own tx which might deadlock?
  // Let's just execute it asynchronously after a tiny delay so it runs out of current tx context.
  setTimeout(async () => {
    try {
      await processReferralCommission(order.id);
      
      const [u] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, order.userId)).limit(1);
      if (u?.phone) {
        let text = `اكتمل طلبك ${order.orderNo} بنجاح! 🎉`;
        if (deliveryData && typeof deliveryData === 'object' && 'text' in deliveryData && typeof deliveryData.text === 'string') {
          text += `\n\nبيانات التسليم:\n${deliveryData.text}`;
        }
        await sendWhatsAppNotification({
          phone: u.phone,
          type: "order",
          text
        });
      }
    } catch (err) {
      console.error("WhatsApp/Commission error after settleAutoTx:", err);
    }
  }, 100);
}

async function refundAutoTx(
  tx: DbTx,
  order: Order,
  reason: string,
): Promise<void> {
  const { entry } = await postLedgerEntryInTx(tx, {
    userId: order.userId,
    type: "release",
    amount: order.totalPrice,
    source: "order",
    relatedOrderId: order.id,
    idempotencyKey: `order-release-${order.id}`,
    reason: `استرجاع الطلب ${order.orderNo} — ${reason}`,
  });
  await tx
    .update(orders)
    .set({
      status: "refunded",
      refundTransactionId: entry.id,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: "refunded",
    note: `استرجاع تلقائي — ${reason}`,
  });
  await tx.insert(notifications).values({
    userId: order.userId,
    type: "order_refunded",
    title: "تم استرجاع مبلغ طلبك",
    body: `تعذّر تنفيذ الطلب ${order.orderNo} فأُعيد مبلغه إلى رصيدك.`,
    metadata: { orderId: order.id },
  });
}

async function markNeedsManualTx(
  tx: DbTx,
  order: Order,
  note: string,
): Promise<void> {
  await tx
    .update(orders)
    .set({ status: "needs_manual", updatedAt: new Date() })
    .where(eq(orders.id, order.id));
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: "needs_manual",
    note,
  });
}

/**
 * إرسال طلب تلقائي إلى المزوّد (استدعاء شبكة خارج المعاملة).
 * يُستدعى بعد أن يكون الحجز قد تم بنجاح.
 */
export async function dispatchOrderToProvider(orderId: string): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return;
  if (!["under_review", "needs_manual"].includes(order.status)) return;

  let finalProvider: typeof providers.$inferSelect | null = null;
  let finalExternalId: string | null = null;
  let fallbackProvider: typeof providers.$inferSelect | null = null;
  let fallbackExternalId: string | null = null;

  if (order.packageId) {
    const [pkg] = await db.select().from(productPackages).where(eq(productPackages.id, order.packageId)).limit(1);
    if (pkg) {
      if (pkg.providerId && pkg.externalProductId) {
        const [prov] = await db.select().from(providers).where(eq(providers.id, pkg.providerId)).limit(1);
        if (prov && prov.status === "active") {
          finalProvider = prov;
          finalExternalId = pkg.externalProductId;
        }
      }
      if (pkg.fallbackProviderId && pkg.fallbackExternalProductId) {
        const [prov2] = await db.select().from(providers).where(eq(providers.id, pkg.fallbackProviderId)).limit(1);
        if (prov2 && prov2.status === "active") {
          fallbackProvider = prov2;
          fallbackExternalId = pkg.fallbackExternalProductId;
        }
      }
    }
  }

  if (!finalProvider) {
    const link = await getProviderLinkForProduct(order.productId);
    if (link && link.provider.status === "active") {
      finalProvider = link.provider;
      finalExternalId = link.link.externalProductId;
    }
  }

  if (!finalProvider || !finalExternalId) {
    await db.transaction((tx) =>
      markNeedsManualTx(tx, order, "يتطلب مراجعة يدوية — لا قناة تنفيذ نشطة."),
    );
    return;
  }

  const executeProvider = async (provider: typeof providers.$inferSelect, externalId: string, isFallback: boolean) => {
    const adapter = getAdapter(provider.adapter);
    const ctx = buildContext(provider);
    const started = Date.now();

    try {
      const result = await adapter.createOrder(ctx, {
        externalProductId: externalId,
        quantity: order.quantity,
        input: (order.inputData ?? {}) as Record<string, unknown>,
        reference: order.orderNo,
      });

      await logApiCall({
        providerId: provider.id,
        orderId: order.id,
        endpoint: "createOrder",
        requestSummary: {
          service: externalId,
          quantity: order.quantity,
        },
        responsePayload: result.raw ?? { status: result.status },
        latencyMs: Date.now() - started,
        success: result.status !== "failed",
      });

      if (result.status === "failed") {
        return false;
      }

      await db.transaction(async (tx) => {
        const providerStatus =
          result.status === "completed" ? "completed" : "sent_to_provider";
        await tx
          .update(orders)
          .set({
            providerId: provider.id,
            externalOrderId: result.externalOrderId,
            status: providerStatus,
            costPrice: result.charge ?? order.costPrice,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
        await tx.insert(orderStatusHistory).values({
          orderId: order.id,
          fromStatus: order.status,
          toStatus: providerStatus,
          note: isFallback ? "بدأ التنفيذ عبر المزوّد الاحتياطي" : "بدأ تنفيذ طلبك",
        });

        if (result.status === "completed") {
          const refreshed = { ...order, status: "sent_to_provider" as const };
          await settleAutoTx(tx, refreshed, { note: "تم التنفيذ فورًا" });
        }
      });
      
      return true;
    } catch (e) {
      await logApiCall({
        providerId: provider.id,
        orderId: order.id,
        endpoint: "createOrder",
        requestSummary: { service: externalId },
        responsePayload: { error: String(e) },
        latencyMs: Date.now() - started,
        success: false,
      });
      return false;
    }
  };

  const primarySuccess = await executeProvider(finalProvider, finalExternalId, false);
  
  if (!primarySuccess) {
    if (fallbackProvider && fallbackExternalId) {
      const fallbackSuccess = await executeProvider(fallbackProvider, fallbackExternalId, true);
      if (!fallbackSuccess) {
        await db.transaction((tx) =>
          refundAutoTx(tx, order, "تعذّر تنفيذ الطلب عبر المزوّد الأساسي والاحتياطي")
        );
      }
    } else {
      await db.transaction((tx) =>
        refundAutoTx(tx, order, "تعذّر تنفيذ الطلب")
      );
    }
  }
}

/** متابعة حالة طلب واحد لدى المزوّد وتحديثه (تسوية/استرجاع/تحديث). */
export async function pollProviderOrder(
  orderId: string,
): Promise<Order["status"] | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order || !order.providerId || !order.externalOrderId) return null;
  if (!POLLABLE.includes(order.status)) return order.status;

  // نتابع لدى المزوّد الذي أُرسل إليه الطلب فعلًا — لا رابط المنتج الحالي،
  // كي لا تختل المتابعة إن غيّر الأدمن ربط المنتج أثناء وجود طلبات معلّقة.
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, order.providerId))
    .limit(1);
  if (!provider) return order.status;

  const adapter = getAdapter(provider.adapter);
  const ctx = buildContext(provider);
  const started = Date.now();

  try {
    const result = await adapter.getStatus(ctx, order.externalOrderId);
    await logApiCall({
      providerId: provider.id,
      orderId: order.id,
      endpoint: "getStatus",
      requestSummary: { externalOrderId: order.externalOrderId },
      responsePayload: result.raw ?? { status: result.status },
      latencyMs: Date.now() - started,
      success: true,
    });

    if (result.status === "completed") {
      await db.transaction((tx) =>
        settleAutoTx(tx, order, result.deliveryData ?? null),
      );
      return "completed";
    }
    if (result.status === "failed") {
      await db.transaction((tx) => refundAutoTx(tx, order, "تعذّر إكمال التنفيذ"));
      return "refunded";
    }
    if (result.status === "partial") {
      await db.transaction((tx) =>
        markNeedsManualTx(tx, order, "تنفيذ جزئي — يتطلب مراجعة يدوية."),
      );
      return "needs_manual";
    }
    // pending / in_progress — نحدّث الحالة ونحفظ تقدّم المزوّد
    // (عدد البدء والمتبقّي) ليظهر للعميل والأدمن.
    await db
      .update(orders)
      .set({
        status: "in_progress",
        deliveryData: result.deliveryData ?? order.deliveryData,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
    return "in_progress";
  } catch (e) {
    await logApiCall({
      providerId: provider.id,
      orderId: order.id,
      endpoint: "getStatus",
      requestSummary: { externalOrderId: order.externalOrderId },
      responsePayload: { error: String(e) },
      latencyMs: Date.now() - started,
      success: false,
    });
    return order.status; // خطأ متابعة مؤقت — نعيد المحاولة لاحقًا
  }
}

/** متابعة دفعة من الطلبات المعلّقة لدى المزوّدين (تُستدعى من cron). */
export async function pollPendingProviderOrders(
  limit = 25,
): Promise<{ polled: number; completed: number; refunded: number }> {
  const pending = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(inArray(orders.status, POLLABLE), isNotNull(orders.providerId)))
    // الأقدم أولًا كي لا تُزاحم الطلبات الجديدة طلبًا قديمًا عالقًا خارج الدفعة
    .orderBy(asc(orders.updatedAt))
    .limit(limit);

  let completed = 0;
  let refunded = 0;
  for (const o of pending) {
    const status = await pollProviderOrder(o.id);
    if (status === "completed") completed++;
    else if (status === "refunded") refunded++;
  }
  return { polled: pending.length, completed, refunded };
}

/**
 * طلب إعادة تعبئة (Refill) لطلب لدى المزوّد — للمتابعين/الإعجابات التي نقصت.
 * يتطلب دعم المحوّل ووجود مرجع خارجي.
 */
export async function requestOrderRefill(orderId: string): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) throw new AppError("not_found", "الطلب غير موجود.", 404);
  if (order.fulfillment !== "automatic" || !order.externalOrderId) {
    throw new AppError("not_refillable", "هذا الطلب لا يدعم إعادة التعبئة.", 409);
  }
  if (!order.providerId) {
    throw new AppError("not_refillable", "لا مزوّد مرتبط بالطلب.", 409);
  }
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, order.providerId))
    .limit(1);
  if (!provider) throw new AppError("not_found", "المزوّد غير موجود.", 404);

  const adapter = getAdapter(provider.adapter);
  if (!adapter.createRefill) {
    throw new AppError("unsupported", "هذا المزوّد لا يدعم إعادة التعبئة.", 409);
  }
  const ctx = buildContext(provider);
  const started = Date.now();
  try {
    const result = await adapter.createRefill(ctx, order.externalOrderId);
    await logApiCall({
      providerId: provider.id,
      orderId: order.id,
      endpoint: "createRefill",
      requestSummary: { externalOrderId: order.externalOrderId },
      responsePayload: result.raw ?? { refillId: result.refillId },
      latencyMs: Date.now() - started,
      success: true,
    });
    await db.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      note: "طُلبت إعادة تعبئة للطلب",
    });
    await db.insert(notifications).values({
      userId: order.userId,
      type: "order_refill",
      title: "طلب إعادة تعبئة",
      body: `أرسلنا طلب إعادة تعبئة لطلبك ${order.orderNo}.`,
      metadata: { orderId: order.id },
    });
  } catch (e) {
    await logApiCall({
      providerId: provider.id,
      orderId: order.id,
      endpoint: "createRefill",
      requestSummary: { externalOrderId: order.externalOrderId },
      responsePayload: { error: String(e) },
      latencyMs: Date.now() - started,
      success: false,
    });
    throw e instanceof AppError
      ? e
      : new AppError("refill_failed", "تعذّرت إعادة التعبئة لدى المزوّد.", 502);
  }
}

/**
 * إعادة إرسال طلب تلقائي علِق (أدمن).
 * تشمل under_review لإنقاذ طلب حُجز مبلغه ثم تعطّل الإرسال قبل بلوغ المزوّد
 * (انقطاع الدالة بين الحجز والإرسال).
 */
export async function retryOrderDispatch(orderId: string): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) throw new AppError("not_found", "الطلب غير موجود.", 404);
  if (order.fulfillment !== "automatic") {
    throw new AppError("not_automatic", "هذا الطلب ليس تلقائيًا.", 409);
  }
  if (!["needs_manual", "under_review"].includes(order.status)) {
    throw new AppError(
      "not_retryable",
      "إعادة الإرسال متاحة فقط للطلبات المعلّقة.",
      409,
    );
  }
  await dispatchOrderToProvider(orderId);
}
