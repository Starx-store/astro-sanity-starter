import { z } from "zod";
import { requireApiUser } from "@/server/auth/api";
import { verifyCryptoDeposit } from "@/server/wallet/crypto-deposits";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  txHash: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{64}$/, "رقم معاملة غير صالح"),
});

/** التحقق من معاملة على السلسلة وإضافة الرصيد تلقائيًا. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireApiUser();
    if (!isUuid(params.id)) return jsonError("طلب الشحن غير موجود.", 404);
    await enforceRateLimit({ key: "crypto-verify", limit: 20, windowMs: 60_000, identifier: user.id });

    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;

    const result = await verifyCryptoDeposit({
      userId: user.id,
      depositId: params.id,
      txHash: parsed.data.txHash,
    });
    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
