import { requireApiUser } from "@/server/auth/api";
import { checkBinanceDeposit } from "@/server/payments/binance/deposits";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * تحقق يدوي من حالة دفع Binance (Polling) — للمالك فقط.
 * ضروري في التطوير المحلي حيث لا تصل Webhooks، وآمن تمامًا ضد الازدواج
 * (نفس مفتاح idempotency الذي يستخدمه الـ Webhook).
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireApiUser();
    if (!isUuid(params.id)) return jsonError("طلب الإيداع غير موجود.", 404);

    const result = await checkBinanceDeposit({
      depositId: params.id,
      userId: user.id,
    });
    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
