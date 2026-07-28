import { z } from "zod";
import { AMOUNT_REGEX, displayAmount } from "@/lib/money";
import { requireApiUser } from "@/server/auth/api";
import { createCryptoDeposit } from "@/server/wallet/crypto-deposits";
import { handleError, jsonOk, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.string().trim().regex(AMOUNT_REGEX, "قيمة غير صالحة"),
});

/** إنشاء طلب شحن بعملة رقمية — يعيد العنوان والمبلغ الفريد الواجب تحويله. */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    await enforceRateLimit({ key: "crypto-dep", limit: 10, windowMs: 60_000, identifier: user.id });

    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;

    const { deposit, config } = await createCryptoDeposit({
      userId: user.id,
      amount: parsed.data.amount,
    });

    return jsonOk(
      {
        depositId: deposit.id,
        address: config.address,
        network: config.network,
        minConfirmations: config.minConfirmations,
        // المبلغ الفريد الواجب تحويله بالضبط، والمبلغ الأصلي للمقارنة.
        exactAmount: displayAmount(deposit.amount),
        requestedAmount: displayAmount(parsed.data.amount),
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
