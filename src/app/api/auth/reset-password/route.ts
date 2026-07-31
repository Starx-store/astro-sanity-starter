import { resetPasswordSchema } from "@/server/validation/auth";
import { resetPassword } from "@/server/auth/service";
import { handleError, jsonOk, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseBody(req, resetPasswordSchema);
  if (!parsed.success) return parsed.response;

  try {
    await enforceRateLimit({ key: "reset-password", limit: 10, windowMs: 15 * 60_000 });
    await resetPassword(parsed.data.token, parsed.data.password);
    return jsonOk({ reset: true });
  } catch (err) {
    return handleError(err);
  }
}
