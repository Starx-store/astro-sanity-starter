import { requireApiUser } from "@/server/auth/api";
import { createOrder } from "@/server/orders/service";
import { createOrderSchema } from "@/server/validation/orders";
import { handleError, jsonOk, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

/** إنشاء طلب — التسعير والتحقق كاملان من الخادم، مع حجز القيمة ذريًّا. */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    await enforceRateLimit({ key: "order", limit: 30, windowMs: 60_000, identifier: user.id });

    const parsed = await parseBody(req, createOrderSchema);
    if (!parsed.success) return parsed.response;

    const { order, replayed } = await createOrder({
      userId: user.id,
      productId: parsed.data.productId,
      packageId: parsed.data.packageId,
      quantity: parsed.data.quantity,
      inputs: parsed.data.inputs,
      idempotencyKey: parsed.data.idempotencyKey,
      couponCode: parsed.data.couponCode,
    });

    return jsonOk(
      {
        order: {
          id: order.id,
          orderNo: order.orderNo,
          totalPrice: order.totalPrice,
          status: order.status,
        },
        replayed,
      },
      replayed ? 200 : 201,
    );
  } catch (err) {
    return handleError(err);
  }
}
