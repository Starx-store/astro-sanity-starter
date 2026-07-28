import { z } from "zod";
import { requireApiUser } from "@/server/auth/api";
import { createBinanceDeposit } from "@/server/payments/binance/deposits";
import { amountFieldSchema } from "@/server/validation/wallet";
import { handleError, jsonOk, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ amount: amountFieldSchema });

/** إنشاء إيداع تلقائي عبر Binance Pay — يعيد رابط الدفع وQR. */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    await enforceRateLimit({ key: "deposit-bp", limit: 10, windowMs: 5 * 60_000, identifier: user.id });

    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;

    const { deposit, pay } = await createBinanceDeposit({
      userId: user.id,
      amount: parsed.data.amount,
    });

    return jsonOk(
      {
        deposit: { id: deposit.id, amount: deposit.amount, status: deposit.status },
        pay: {
          checkoutUrl: pay.checkoutUrl ?? null,
          universalUrl: pay.universalUrl ?? null,
          qrcodeLink: pay.qrcodeLink ?? null,
          expireTime: pay.expireTime ?? null,
        },
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
