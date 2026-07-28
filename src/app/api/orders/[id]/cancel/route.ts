import { requireApiUser } from "@/server/auth/api";
import { customerCancelOrder } from "@/server/orders/service";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/** إلغاء العميل لطلبه قبل بدء التنفيذ — يفك الحجز ويعيد المبلغ للمتاح. */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireApiUser();
    if (!isUuid(params.id)) return jsonError("الطلب غير موجود.", 404);

    await customerCancelOrder({ orderId: params.id, userId: user.id });
    return jsonOk({ cancelled: true });
  } catch (err) {
    return handleError(err);
  }
}
