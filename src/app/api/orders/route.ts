import { getSessionUser } from "@/server/auth/session";
import { createSession } from "@/server/auth/session";
import { findOrCreateGuestUser } from "@/server/auth/service";
import { createOrder } from "@/server/orders/service";
import { createOrderSchema } from "@/server/validation/orders";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

/** إنشاء طلب — الشراء السريع للزائر بالبريد أو المستخدم المسجل، والتسعير كامل من الخادم. */
export async function POST(req: Request) {
  try {
    let user = await getSessionUser();

    const parsed = await parseBody(req, createOrderSchema);
    if (!parsed.success) return parsed.response;

    // إذا كان زائرًا ولم يسجل الدخول، يفحص بريد الشراء السريع
    if (!user) {
      // حماية من إنشاء حسابات وهمية بالجملة: تحديد بالـ IP قبل إنشاء الحساب
      await enforceRateLimit({ key: "guest-checkout", limit: 5, windowMs: 10 * 60_000 });

      const guestEmail = parsed.data.guestEmail?.trim();
      if (!guestEmail || !guestEmail.includes("@")) {
        return jsonError("يرجى إدخال البريد الإلكتروني أو تسجيل الدخول لإتمام الطلب.", 401);
      }
      const guestUser = await findOrCreateGuestUser(guestEmail);
      await createSession(guestUser.id);
      user = guestUser;
    }

    await enforceRateLimit({ key: "order", limit: 30, windowMs: 60_000, identifier: user.id });

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
