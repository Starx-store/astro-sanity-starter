import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import {
  orders,
  orderStatusHistory,
  orderMessages,
  products,
  productPackages,
  productQuantityConfig,
  productStockItems,
  customerPrices,
  priceTiers,
  notifications,
  auditLogs,
  users,
  type Order,
} from "@/server/db/schema";
import { AppError, WalletError, isPgError } from "@/server/errors";
import {
  parseAmount,
  parseQty,
  toDbAmount,
  toDbQty,
  mulAmountByQty,
  per1000ToUnit,
  displayAmount,
  applyPercentDiscount,
} from "@/lib/money";
import { getUserOrderDiscountPercent } from "@/server/account/tier";
import { previewCoupon, redeemCouponInTx } from "./coupons";
import { generateReferenceNo } from "@/server/auth/tokens";
import { postLedgerEntryInTx } from "@/server/wallet/service";
import { processReferralCommission } from "@/server/referrals/service";
import { requiredFieldDefSchema } from "@/server/validation/catalog";
import { getProviderLinkForProduct } from "@/server/providers/service";
import { dispatchOrderToProvider } from "@/server/providers/fulfillment";
import {
  notifyAdminNewOrder,
  sendOrderDeliveryEmail,
} from "@/server/email";
import { sendWhatsAppNotification } from "@/server/notifications/whatsapp";
import type { SessionUser } from "@/server/auth/session";

/**
 * خدمة الطلبات — المرحلة 2 (التنفيذ اليدوي).
 * المبدأ الحاكم: السعر يُحسب من قاعدة البيانات فقط؛ لا يُوثق بأي رقم من الواجهة.
 */

export type OrderStatus = Order["status"];

/**
 * انتقالات الحالة المسموحة يدويًا (أدمن).
 * تشمل تجاوزات للطلبات التلقائية العالقة (sent_to_provider / needs_manual)
 * ليتمكن الأدمن من الإكمال أو الاسترجاع يدويًا عند تعذّر المزوّد.
 */
export const MANUAL_TRANSITIONS: Record<string, OrderStatus[]> = {
  under_review: ["in_progress", "needs_info", "completed", "refunded"],
  needs_info: ["under_review", "in_progress", "refunded"],
  in_progress: ["completed", "needs_info", "refunded"],
  sent_to_provider: ["completed", "refunded", "needs_manual"],
  needs_manual: ["in_progress", "completed", "refunded"],
  completed: [],
  refunded: [],
};

/* ------------------------------------------------------------------ */
/*  التسعير الخادمي                                                    */
/* ------------------------------------------------------------------ */

interface PricedOrder {
  product: typeof products.$inferSelect;
  packageId: string | null;
  quantity4: bigint | null;
  unit: string | null;
  unitPrice: bigint;
  total: bigint;
  cost: bigint;
}

async function priceOrder(input: {
  productId: string;
  packageId?: string;
  quantity?: string;
  userId?: string;
}): Promise<PricedOrder> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);

  if (!product || product.status === "hidden") {
    throw new AppError("product_not_found", "المنتج غير موجود.", 404);
  }
  if (product.status !== "active") {
    throw new AppError(
      "product_unavailable",
      product.status === "maintenance"
        ? "المنتج تحت الصيانة حاليًا — جرّب لاحقًا."
        : "الكمية نفدت مؤقتًا — جرّب لاحقًا.",
      409,
    );
  }

  // سعر خاص لهذا العميل على هذا المنتج (أعلى أولوية — يتقدّم على سعر
  // التاجر وخصومات الباقات معًا).
  const customPrices = input.userId
    ? await db
        .select()
        .from(customerPrices)
        .where(
          and(
            eq(customerPrices.userId, input.userId),
            eq(customerPrices.productId, product.id),
          ),
        )
    : [];

  // باقة التاجر: سعر مستقل يحدده الأدمن داخل المنتج (ليس نسبة خصم).
  const isTrader = input.userId
    ? ((
        await db
          .select({ isTrader: users.isTrader })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1)
      )[0]?.isTrader ?? false)
    : false;

  // منتج حصري للتجار: نرفض طلب غير التاجر هنا لا في الواجهة فقط — وإلا
  // أمكن الطلب مباشرة عبر الـ API متجاوزًا إخفاء المتجر.
  if (product.traderOnly && !isTrader) {
    throw new AppError(
      "trader_only",
      "هذا المنتج متاح لحسابات التجار فقط.",
      403,
    );
  }

  // خصم باقة العضوية (يُطبّق على سعر البيع فقط، ولا يُجمع مع سعر التاجر).
  const discountPct = input.userId
    ? await getUserOrderDiscountPercent(input.userId)
    : 0;

  if (product.type === "package") {
    if (!input.packageId) {
      throw new AppError("package_required", "اختر بكجًا.", 422, {
        packageId: "اختر بكجًا",
      });
    }
    const [pkg] = await db
      .select()
      .from(productPackages)
      .where(
        and(
          eq(productPackages.id, input.packageId),
          eq(productPackages.productId, product.id),
        ),
      )
      .limit(1);
    if (!pkg || !pkg.isAvailable) {
      throw new AppError("package_unavailable", "البكج غير متاح.", 409, {
        packageId: "البكج غير متاح — اختر غيره",
      });
    }
    if (pkg.packageType === "quantity") {
      if (!input.quantity) {
        throw new AppError("quantity_required", "أدخل الكمية.", 422, {
          quantity: "أدخل الكمية",
        });
      }
      const qty = parseQty(input.quantity);
      const minQty = parseQty(pkg.minQty || "1");
      const maxQty = pkg.maxQty ? parseQty(pkg.maxQty) : null;
      if (qty < minQty) {
        throw new AppError("qty_below_min", "الكمية أقل من الحد الأدنى.", 422, {
          quantity: `الحد الأدنى ${displayAmount(pkg.minQty || "1")}`,
        });
      }
      if (maxQty !== null && qty > maxQty) {
        throw new AppError("qty_above_max", "الكمية أكبر من الحد الأقصى.", 422, {
          quantity: `الحد الأقصى ${displayAmount(pkg.maxQty!)}`,
        });
      }

      const p1000 =
        isTrader && pkg.traderPricePer1000
          ? pkg.traderPricePer1000
          : pkg.pricePer1000 || pkg.salePrice;

      let unitPrice = per1000ToUnit(parseAmount(p1000));
      if (unitPrice <= 0n) {
        unitPrice = parseAmount(pkg.salePrice);
      }
      if (discountPct > 0 && !(isTrader && pkg.traderPricePer1000)) {
        unitPrice = applyPercentDiscount(unitPrice, discountPct);
      }

      const total = mulAmountByQty(unitPrice, qty);
      if (total <= 0n) {
        throw new AppError("total_too_small", "إجمالي الطلب صغير جدًا.", 422);
      }

      const costUnit = per1000ToUnit(parseAmount(pkg.costPrice || "0"));
      const cost = costUnit > 0n ? mulAmountByQty(costUnit, qty) : parseAmount(pkg.costPrice || "0");

      return {
        product,
        packageId: pkg.id,
        quantity4: qty,
        unit: null,
        unitPrice,
        total,
        cost,
      };
    }

    let price: bigint;
    const customPkg = customPrices.find((c) => c.packageId === pkg.id);
    if (customPkg) {
      // سعر خاص بالعميل لهذا البكج — يتقدّم على كل شيء.
      price = parseAmount(customPkg.price);
    } else if (isTrader && pkg.traderPrice) {
      // سعر التاجر يحل محل سعر البيع تمامًا — لا يتراكب مع خصم الباقات.
      price = parseAmount(pkg.traderPrice);
    } else {
      const basePrice = parseAmount(pkg.salePrice);
      price =
        discountPct > 0
          ? applyPercentDiscount(basePrice, discountPct)
          : basePrice;
    }
    if (price <= 0n) {
      throw new AppError("total_too_small", "إجمالي الطلب صغير جدًا.", 422);
    }

    const fixedQty = parseQty(pkg.quantity || "1");
    return {
      product,
      packageId: pkg.id,
      quantity4: fixedQty > 0n ? fixedQty : null,
      unit: null,
      unitPrice: price,
      total: price,
      cost: parseAmount(pkg.costPrice),
    };
  }

  // منتج كمية
  if (!input.quantity) {
    throw new AppError("quantity_required", "أدخل الكمية.", 422, {
      quantity: "أدخل الكمية",
    });
  }
  const [cfg] = await db
    .select()
    .from(productQuantityConfig)
    .where(eq(productQuantityConfig.productId, product.id))
    .limit(1);
  if (!cfg) {
    throw new AppError("product_misconfigured", "المنتج غير مهيأ للبيع بعد.", 409);
  }

  const qty = parseQty(input.quantity);
  const minQty = parseQty(cfg.minQty);
  const maxQty = cfg.maxQty ? parseQty(cfg.maxQty) : null;
  if (qty < minQty) {
    throw new AppError("qty_below_min", "الكمية أقل من الحد الأدنى.", 422, {
      quantity: `الحد الأدنى ${displayAmount(cfg.minQty)} ${cfg.unit}`,
    });
  }
  if (maxQty !== null && qty > maxQty) {
    throw new AppError("qty_above_max", "الكمية أكبر من الحد الأقصى.", 422, {
      quantity: `الحد الأقصى ${displayAmount(cfg.maxQty!)} ${cfg.unit}`,
    });
  }

  // شريحة السعر الأنسب: أعلى min_qty تنطبق على الكمية
  const tiers = await db
    .select()
    .from(priceTiers)
    .where(eq(priceTiers.productId, product.id))
    .orderBy(asc(priceTiers.minQty));

  let unitPrice: bigint | null = null;
  for (const t of tiers) {
    const tMin = parseQty(t.minQty);
    const tMax = t.maxQty ? parseQty(t.maxQty) : null;
    if (qty >= tMin && (tMax === null || qty <= tMax)) {
      unitPrice = parseAmount(t.pricePerUnit);
    }
  }
  if (unitPrice === null && cfg.pricePerUnit) {
    unitPrice = parseAmount(cfg.pricePerUnit);
  }
  if (unitPrice === null && cfg.pricePer1000) {
    unitPrice = per1000ToUnit(parseAmount(cfg.pricePer1000));
  }
  if (unitPrice === null || unitPrice <= 0n) {
    throw new AppError("product_misconfigured", "تسعير المنتج غير مكتمل.", 409);
  }

  // سعر خاص بالعميل للكمية (لكل 1000) — أعلى أولوية.
  const customQty = customPrices.find((c) => c.packageId === null);
  if (customQty) {
    const customUnit = per1000ToUnit(parseAmount(customQty.price));
    if (customUnit <= 0n) {
      throw new AppError(
        "product_misconfigured",
        "السعر الخاص لهذا العميل غير صالح.",
        409,
      );
    }
    const total = mulAmountByQty(customUnit, qty);
    if (total <= 0n) {
      throw new AppError("total_too_small", "إجمالي الطلب صغير جدًا.", 422, {
        quantity: "زد الكمية — الإجمالي الناتج صفر",
      });
    }
    return {
      product,
      packageId: null,
      quantity4: qty,
      unit: cfg.unit,
      unitPrice: customUnit,
      total,
      cost: mulAmountByQty(parseAmount(cfg.costPrice), qty),
    };
  }

  // سعر التاجر للكمية (إن حُدّد) يحل محل السعر والشرائح والخصومات معًا.
  const traderUnit =
    isTrader && cfg.traderPricePerUnit
      ? parseAmount(cfg.traderPricePerUnit)
      : isTrader && cfg.traderPricePer1000
        ? per1000ToUnit(parseAmount(cfg.traderPricePer1000))
        : null;
  if (traderUnit !== null) {
    // سعر تاجر مُدخل لكنه يؤول لصفر = تهيئة خاطئة — نفشل بوضوح
    // بدل أن يدفع التاجر السعر العادي بصمت.
    if (traderUnit <= 0n) {
      throw new AppError(
        "product_misconfigured",
        "تسعير التاجر لهذا المنتج غير مكتمل.",
        409,
      );
    }
    unitPrice = traderUnit;
  } else if (discountPct > 0) {
    unitPrice = applyPercentDiscount(unitPrice, discountPct);
  }

  const total = mulAmountByQty(unitPrice, qty);
  if (total <= 0n) {
    throw new AppError("total_too_small", "إجمالي الطلب صغير جدًا.", 422, {
      quantity: "زد الكمية — الإجمالي الناتج صفر",
    });
  }
  const cost = mulAmountByQty(parseAmount(cfg.costPrice), qty);

  return {
    product,
    packageId: null,
    quantity4: qty,
    unit: cfg.unit,
    unitPrice,
    total,
    cost,
  };
}

/* ------------------------------------------------------------------ */
/*  التحقق من الحقول المطلوبة                                          */
/* ------------------------------------------------------------------ */

const defsSchema = z.array(requiredFieldDefSchema);

function validateInputs(
  rawDefs: unknown,
  inputs: Record<string, unknown>,
): Record<string, string> {
  const parsed = defsSchema.safeParse(rawDefs);
  const defs = parsed.success ? parsed.data : [];

  const data: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const def of defs) {
    const raw = inputs[def.key];
    const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();

    if (!value) {
      if (def.required) errors[def.key] = `${def.label}: مطلوب`;
      continue;
    }
    if (value.length > 1000) {
      errors[def.key] = `${def.label}: طويل جدًا`;
      continue;
    }
    if (def.type === "url" && !/^https?:\/\/\S+$/i.test(value)) {
      errors[def.key] = `${def.label}: رابط غير صالح (يبدأ بـ http)`;
      continue;
    }
    if (def.type === "email" && !/^\S+@\S+\.\S+$/.test(value)) {
      errors[def.key] = `${def.label}: بريد غير صالح`;
      continue;
    }
    if (def.type === "number" && !/^-?\d+(\.\d+)?$/.test(value)) {
      errors[def.key] = `${def.label}: أرقام فقط`;
      continue;
    }
    data[def.key] = value;
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("invalid_inputs", "أكمل بيانات الطلب المطلوبة.", 422, errors);
  }
  return data;
}

/* ------------------------------------------------------------------ */
/*  إنشاء الطلب (مع الحجز)                                             */
/* ------------------------------------------------------------------ */

export async function createOrder(params: {
  userId: string;
  productId: string;
  packageId?: string;
  quantity?: string;
  inputs: Record<string, unknown>;
  idempotencyKey: string;
  /** رمز كوبون اختياري — يُتحقق منه ويُخصم من الإجمالي. */
  couponCode?: string;
}): Promise<{ order: Order; replayed: boolean }> {
  const priced = await priceOrder(params);

  // كوبون الخصم (إن وُجد) — يُحسب على الإجمالي بعد كل قواعد التسعير.
  const coupon = params.couponCode?.trim()
    ? await previewCoupon({
        code: params.couponCode,
        userId: params.userId,
        total: priced.total,
      })
    : null;
  const finalTotal = coupon ? coupon.newTotal : priced.total;
  const inputData = validateInputs(priced.product.requiredFields, params.inputs);
  const orderNo = generateReferenceNo("ORD");
  const isAuto = priced.product.fulfillment === "automatic";
  const isStock = priced.product.fulfillment === "stock";

  // منتجات المخزون: كل وحدة كمية = عنصر مخزون واحد، فالكمية عدد صحيح حتمًا.
  let stockNeeded = 0;
  if (isStock) {
    if (priced.quantity4 !== null) {
      if (priced.quantity4 % 10000n !== 0n) {
        throw new AppError(
          "qty_not_integer",
          "الكمية لهذا المنتج يجب أن تكون عددًا صحيحًا.",
          422,
          { quantity: "أدخل عددًا صحيحًا" },
        );
      }
      stockNeeded = Number(priced.quantity4 / 10000n);
    } else {
      stockNeeded = 1;
    }
    if (stockNeeded < 1) {
      throw new AppError("qty_below_min", "الكمية غير صالحة.", 422);
    }
  }

  // منتج تلقائي بلا مزوّد نشط مرتبط ⇒ غير قابل للطلب (لا نحجز مال العميل في طلب عالق)
  if (isAuto) {
    const link = await getProviderLinkForProduct(priced.product.id);
    if (!link || link.provider.status !== "active") {
      throw new AppError(
        "product_unavailable",
        "المنتج غير متاح للطلب حاليًا.",
        409,
      );
    }
  }

  try {
    const order = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({
          orderNo,
          userId: params.userId,
          productId: priced.product.id,
          packageId: priced.packageId,
          quantity: priced.quantity4 !== null ? toDbQty(priced.quantity4) : null,
          unitPrice: toDbAmount(priced.unitPrice),
          totalPrice: toDbAmount(finalTotal),
          costPrice: toDbAmount(priced.cost),
          fulfillment: priced.product.fulfillment,
          status: "under_review",
          inputData,
          idempotencyKey: params.idempotencyKey,
        })
        .returning();

      // حجز قيمة الطلب — يرفض تلقائيًا إن كان المتاح غير كافٍ (يفشل الطلب كله)
      const { entry } = await postLedgerEntryInTx(tx, {
        userId: params.userId,
        type: "hold",
        amount: finalTotal,
        source: "order",
        relatedOrderId: created.id,
        idempotencyKey: `order-hold-${created.id}`,
        reason: `حجز قيمة الطلب ${orderNo}`,
      });

      const [updated] = await tx
        .update(orders)
        .set({ holdTransactionId: entry.id })
        .where(eq(orders.id, created.id))
        .returning();

      await tx.insert(orderStatusHistory).values({
        orderId: created.id,
        fromStatus: null,
        toStatus: "under_review",
        changedBy: params.userId,
        note: "إنشاء الطلب وحجز قيمته من المحفظة",
      });

      // تسجيل الكوبون داخل نفس المعاملة — إن استُنفد تنهار المعاملة كلها
      // فلا يُخصم من العميل شيء ولا يُحتسب الكوبون.
      if (coupon) {
        await redeemCouponInTx(tx, {
          codeId: coupon.codeId,
          userId: params.userId,
          orderId: created.id,
          amountOff: coupon.amountOff,
        });
      }

      // تسليم فوري من المخزون — ذريًّا داخل نفس المعاملة:
      // نقفل العناصر بـ SKIP LOCKED (لا بيع مزدوج)، وإن نقص المخزون
      // تنهار المعاملة كلها فيرتد الحجز ولا يُخصم من العميل شيء.
      if (isStock) {
        const locked = await tx
          .select({
            id: productStockItems.id,
            content: productStockItems.content,
          })
          .from(productStockItems)
          .where(
            and(
              eq(productStockItems.productId, priced.product.id),
              eq(productStockItems.status, "available"),
              priced.packageId
                ? eq(productStockItems.packageId, priced.packageId)
                : isNull(productStockItems.packageId),
            ),
          )
          .orderBy(asc(productStockItems.createdAt))
          .limit(stockNeeded)
          .for("update", { skipLocked: true });

        if (locked.length < stockNeeded) {
          throw new AppError(
            "out_of_stock",
            "نفد المخزون لهذا المنتج مؤقتًا — جرّب لاحقًا.",
            409,
          );
        }

        await tx
          .update(productStockItems)
          .set({ status: "sold", orderId: created.id, soldAt: new Date() })
          .where(
            inArray(
              productStockItems.id,
              locked.map((i) => i.id),
            ),
          );

        const { entry: settle } = await postLedgerEntryInTx(tx, {
          userId: params.userId,
          type: "purchase",
          // يجب أن تطابق المبلغ المحجوز (بعد الكوبون) وإلا بقي فرق محجوزًا.
          amount: finalTotal,
          source: "order",
          relatedOrderId: created.id,
          idempotencyKey: `order-settle-${created.id}`,
          reason: `تسوية الطلب ${orderNo} (تسليم فوري من المخزون)`,
        });

        const [done] = await tx
          .update(orders)
          .set({
            status: "completed",
            settleTransactionId: settle.id,
            deliveryData: { text: locked.map((i) => i.content).join("\n\n") },
          })
          .where(eq(orders.id, created.id))
          .returning();

        await tx.insert(orderStatusHistory).values({
          orderId: created.id,
          fromStatus: "under_review",
          toStatus: "completed",
          note: "تسليم فوري من المخزون",
        });
        await tx.insert(notifications).values({
          userId: params.userId,
          type: "order_completed",
          title: "اكتمل طلبك 🎉",
          body: `تم تسليم طلبك ${orderNo} فورًا — افتح الطلب لعرض المحتوى.`,
          metadata: { orderId: created.id, orderNo },
        });

        return done;
      }

      return updated;
    });

    // إشعارات البريد بعد نجاح المعاملة المالية (فشلها لا يمس الطلب).
    const [buyer] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1);
    await notifyAdminNewOrder({
      orderNo,
      productName: priced.product.name,
      total: displayAmount(finalTotal),
      customerEmail: buyer?.email ?? "غير معروف",
      status: order.status,
    });
    if (isStock && buyer?.email) {
      const delivery = (order.deliveryData ?? null) as { text?: string } | null;
      if (delivery?.text) {
        await sendOrderDeliveryEmail(buyer.email, orderNo, delivery.text);
      }
    }
    if (isStock) {
      setTimeout(async () => {
        try {
          const [u] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, params.userId)).limit(1);
          if (u?.phone) {
            const delivery = (order.deliveryData ?? null) as { text?: string } | null;
            let text = `اكتمل طلبك ${orderNo} بنجاح! 🎉`;
            if (delivery?.text) {
              text += `\n\nبيانات التسليم:\n${delivery.text}`;
            }
            await sendWhatsAppNotification({ phone: u.phone, type: "order", text });
          }
        } catch (err) {
          console.error("WhatsApp instant stock delivery notification error:", err);
        }
      }, 100);
    }

    // التنفيذ التلقائي: الإرسال للمزوّد خارج المعاملة (استدعاء شبكة).
    // الحجز تم بالفعل؛ فشل الإرسال يحوّل الطلب إلى needs_manual دون خسارة مال.
    if (isAuto) {
      await dispatchOrderToProvider(order.id);
      const [fresh] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, order.id))
        .limit(1);
      return { order: fresh ?? order, replayed: false };
    }

    return { order, replayed: false };
  } catch (e) {
    // ضغط مزدوج: نفس idempotencyKey ⇒ أعد الطلب الموجود
    // (مقيّد بمالكه — مفتاح مسرّب من مستخدم آخر لا يكشف طلبه)
    if (isPgError(e, "23505")) {
      const [existing] = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.idempotencyKey, params.idempotencyKey),
            eq(orders.userId, params.userId),
          ),
        )
        .limit(1);
      if (existing) return { order: existing, replayed: true };
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/*  انتقالات الحالة (أدمن)                                             */
/* ------------------------------------------------------------------ */

const CUSTOMER_NOTIFY: Record<string, { title: string; body: (no: string) => string }> = {
  in_progress: {
    title: "جاري تنفيذ طلبك",
    body: (no) => `بدأنا العمل على طلبك ${no}.`,
  },
  needs_info: {
    title: "طلبك بحاجة لمعلومات إضافية",
    body: (no) => `افتح طلبك ${no} وردّ على رسالة الفريق لنكمل التنفيذ.`,
  },
  completed: {
    title: "اكتمل طلبك 🎉",
    body: (no) => `تم تنفيذ طلبك ${no} — افتح الطلب للاطلاع على التسليم.`,
  },
  refunded: {
    title: "تم استرجاع مبلغ طلبك",
    body: (no) => `أُعيد مبلغ الطلب ${no} إلى رصيدك المتاح.`,
  },
};

function assertTransition(from: string, to: OrderStatus) {
  const allowed = MANUAL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError(
      "invalid_transition",
      `لا يمكن الانتقال من هذه الحالة (${from} → ${to}).`,
      409,
    );
  }
}

export async function adminUpdateOrderStatus(params: {
  orderId: string;
  adminId: string;
  to: "in_progress" | "needs_info" | "completed" | "refunded";
  note?: string | null;
  deliveryText?: string | null;
  ip?: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, params.orderId))
      .for("update");
    if (!order) throw new AppError("not_found", "الطلب غير موجود.", 404);
    if (order.fulfillment !== "manual") {
      // الطلبات التلقائية تُدار عبر المزوّد، إلا العالقة منها: يُسمح للأدمن
      // بإنقاذها يدويًا (إكمال/استرجاع) كما توثّقه MANUAL_TRANSITIONS.
      // المال محمي بمفاتيح idempotency وقيود المحفظة حتى لو تزامنت المتابعة.
      const stuckAuto: OrderStatus[] = [
        "under_review",
        "needs_manual",
        "sent_to_provider",
      ];
      if (!stuckAuto.includes(order.status)) {
        throw new AppError("not_manual", "هذا الطلب ليس تنفيذًا يدويًا.", 409);
      }
    }
    assertTransition(order.status, params.to);

    const note = params.note?.trim() || null;
    const patch: Partial<typeof orders.$inferInsert> = {
      status: params.to,
      updatedAt: new Date(),
    };

    if (params.to === "completed") {
      const { entry } = await postLedgerEntryInTx(tx, {
        userId: order.userId,
        type: "purchase",
        amount: order.totalPrice,
        source: "order",
        relatedOrderId: order.id,
        idempotencyKey: `order-settle-${order.id}`,
        performedBy: params.adminId,
        reason: `تسوية الطلب ${order.orderNo}`,
      });
      patch.settleTransactionId = entry.id;
      if (params.deliveryText?.trim()) {
        patch.deliveryData = { text: params.deliveryText.trim() };
      }
    }

    if (params.to === "refunded") {
      const { entry } = await postLedgerEntryInTx(tx, {
        userId: order.userId,
        type: "release",
        amount: order.totalPrice,
        source: "order",
        relatedOrderId: order.id,
        idempotencyKey: `order-release-${order.id}`,
        performedBy: params.adminId,
        reason: `استرجاع قيمة الطلب ${order.orderNo} — ${note ?? ""}`.trim(),
      });
      patch.refundTransactionId = entry.id;
    }

    await tx.update(orders).set(patch).where(eq(orders.id, order.id));

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: params.to,
      changedBy: params.adminId,
      note,
    });

    // طلب المعلومات يصل العميل كرسالة داخل الطلب أيضًا
    if (params.to === "needs_info" && note) {
      await tx.insert(orderMessages).values({
        orderId: order.id,
        sender: "staff",
        senderId: params.adminId,
        body: note,
      });
    }

    const n = CUSTOMER_NOTIFY[params.to];
    if (n) {
      await tx.insert(notifications).values({
        userId: order.userId,
        type: `order_${params.to}`,
        title: n.title,
        body: n.body(order.orderNo),
        metadata: { orderId: order.id, orderNo: order.orderNo },
      });
    }

    await tx.insert(auditLogs).values({
      actorId: params.adminId,
      action: "order.status",
      entityType: "order",
      entityId: order.id,
      before: { status: order.status },
      after: { status: params.to, note },
      ip: params.ip ?? null,
    });
  });

  // بريد تسليم عند الإكمال اليدوي (بعد نجاح المعاملة — فشله لا يمس الطلب).
  if (params.to === "completed") {
    const [row] = await db
      .select({ email: users.email, phone: users.phone, orderNo: orders.orderNo })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .where(eq(orders.id, params.orderId))
      .limit(1);
    
    if (row?.email && params.deliveryText?.trim()) {
      await sendOrderDeliveryEmail(
        row.email,
        row.orderNo,
        params.deliveryText.trim(),
      );
    }
    
    if (row?.phone) {
      setTimeout(async () => {
        try {
          let text = `اكتمل طلبك ${row.orderNo} بنجاح! 🎉`;
          if (params.deliveryText?.trim()) {
            text += `\n\nبيانات التسليم:\n${params.deliveryText.trim()}`;
          }
          await sendWhatsAppNotification({ phone: row.phone!, type: "order", text });
        } catch (err) {
          console.error("WhatsApp manual completion notification error:", err);
        }
      }, 100);
    }
  }

  if (params.to === "completed") {
    await processReferralCommission(params.orderId).catch(console.error);
  }
}

/* ------------------------------------------------------------------ */
/*  إلغاء العميل                                                       */
/* ------------------------------------------------------------------ */

export async function customerCancelOrder(params: {
  orderId: string;
  userId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, params.orderId))
      .for("update");
    if (!order || order.userId !== params.userId) {
      throw new AppError("not_found", "الطلب غير موجود.", 404);
    }
    if (!["under_review", "needs_info"].includes(order.status)) {
      throw new AppError(
        "cancel_not_allowed",
        "لا يمكن إلغاء الطلب بعد بدء التنفيذ — تواصل مع الدعم.",
        409,
      );
    }

    const { entry } = await postLedgerEntryInTx(tx, {
      userId: order.userId,
      type: "release",
      amount: order.totalPrice,
      source: "order",
      relatedOrderId: order.id,
      idempotencyKey: `order-release-${order.id}`,
      reason: `إلغاء الطلب ${order.orderNo} من العميل`,
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
      changedBy: params.userId,
      note: "إلغاء من العميل قبل التنفيذ — أُعيد المبلغ للمتاح",
    });
  });
}

/* ------------------------------------------------------------------ */
/*  مراسلات الطلب                                                      */
/* ------------------------------------------------------------------ */

export async function addOrderMessage(params: {
  orderId: string;
  user: SessionUser;
  body: string;
  asStaff: boolean;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, params.orderId))
      .for("update");
    if (!order) throw new AppError("not_found", "الطلب غير موجود.", 404);

    if (!params.asStaff && order.userId !== params.user.id) {
      throw new AppError("forbidden", "غير مصرّح.", 403);
    }

    await tx.insert(orderMessages).values({
      orderId: order.id,
      sender: params.asStaff ? "staff" : "customer",
      senderId: params.user.id,
      body: params.body,
    });

    // رد العميل على "بحاجة لمعلومات" يعيد الطلب لقيد المراجعة تلقائيًا
    if (!params.asStaff && order.status === "needs_info") {
      await tx
        .update(orders)
        .set({ status: "under_review", updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: "needs_info",
        toStatus: "under_review",
        changedBy: params.user.id,
        note: "ردّ العميل بالمعلومات المطلوبة",
      });
    }

    // إشعار العميل عند رسالة من الفريق
    if (params.asStaff) {
      await tx.insert(notifications).values({
        userId: order.userId,
        type: "order_message",
        title: "رسالة جديدة على طلبك",
        body: `لديك رد من الفريق على الطلب ${order.orderNo}.`,
        metadata: { orderId: order.id },
      });
    }
  });
}
