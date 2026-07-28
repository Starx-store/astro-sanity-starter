import { requireApiUser } from "@/server/auth/api";
import { disableTwoFactor } from "@/server/auth/twofactor";
import { verifySchema } from "@/server/validation/auth";
import { handleError, jsonOk, parseBody } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const parsed = await parseBody(req, verifySchema);
    if (!parsed.success) return parsed.response;
    await disableTwoFactor(user.id, parsed.data.code);
    return jsonOk({ disabled: true });
  } catch (err) {
    return handleError(err);
  }
}
