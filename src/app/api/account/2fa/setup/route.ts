import { requireApiUser } from "@/server/auth/api";
import { setupTwoFactor } from "@/server/auth/twofactor";
import { enforceRateLimit } from "@/server/rate-limit";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireApiUser();
    await enforceRateLimit({ key: "2fa-setup", limit: 10, windowMs: 10 * 60_000, identifier: user.id });
    const result = await setupTwoFactor(user.id);
    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
