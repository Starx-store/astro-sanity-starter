import { z } from "zod";
import { getSessionUser } from "@/server/auth/session";
import { previewCoupon } from "@/server/orders/coupons";
import { parseAmount, displayAmount } from "@/lib/money";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(1, "رمز الكوبون مطلوب"),
  productId: z.string().optional(),
  total: z.string().trim().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("يجب تسجيل الدخول لفحص الكوبون.", 401);

    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;
    const { code, productId, total } = parsed.data;

    const rawTotal = total && !Number.isNaN(Number(total)) ? parseAmount(total) : 10000n; // افتراضي $1.00 إن لم يحدد

    const preview = await previewCoupon({
      code,
      userId: user.id,
      total: rawTotal,
      productId,
    });

    return jsonOk({
      codeId: preview.codeId,
      code: preview.code,
      type: preview.type,
      value: preview.value,
      amountOff: displayAmount(preview.amountOff),
      newTotal: displayAmount(preview.newTotal),
      originalTotal: displayAmount(rawTotal),
    });
  } catch (err) {
    return handleError(err);
  }
}
