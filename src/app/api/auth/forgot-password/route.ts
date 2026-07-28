import { forgotPasswordSchema } from "@/server/validation/auth";
import { requestPasswordReset } from "@/server/auth/service";
import { handleError, jsonOk, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseBody(req, forgotPasswordSchema);
  if (!parsed.success) return parsed.response;

  try {
    await enforceRateLimit({ key: "forgot", limit: 5, windowMs: 15 * 60_000 });
    const { devToken } = await requestPasswordReset(parsed.data.email);
    // نرد دائمًا بنجاح لعدم كشف وجود البريد.
    return jsonOk({
      message: "إن كان البريد مسجّلًا فستصلك تعليمات الاستعادة.",
      devToken,
    });
  } catch (err) {
    return handleError(err);
  }
}
