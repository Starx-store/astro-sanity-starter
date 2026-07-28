import { verifySchema } from "@/server/validation/auth";
import { verifyEmailOtp, AuthError } from "@/server/auth/service";
import { getSessionUser } from "@/server/auth/session";
import { handleError, jsonOk, parseBody } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseBody(req, verifySchema);
  if (!parsed.success) return parsed.response;

  try {
    const user = await getSessionUser();
    if (!user) throw new AuthError("unauthenticated", "يجب تسجيل الدخول.", 401);

    await verifyEmailOtp(user.id, parsed.data.code);
    return jsonOk({ verified: true });
  } catch (err) {
    return handleError(err);
  }
}
