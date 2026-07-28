import { resendEmailOtp, AuthError } from "@/server/auth/service";
import { getSessionUser } from "@/server/auth/session";
import { enforceRateLimit } from "@/server/rate-limit";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

/** إعادة إرسال رمز تحقق البريد للمستخدم الحالي. */
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthError("unauthenticated", "يجب تسجيل الدخول.", 401);
    await enforceRateLimit({ key: "resend-otp", limit: 5, windowMs: 10 * 60_000, identifier: user.id });

    const result = await resendEmailOtp(user.id);
    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
