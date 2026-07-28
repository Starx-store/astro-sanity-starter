import { resetPasswordSchema } from "@/server/validation/auth";
import { resetPassword } from "@/server/auth/service";
import { handleError, jsonOk, parseBody } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseBody(req, resetPasswordSchema);
  if (!parsed.success) return parsed.response;

  try {
    await resetPassword(parsed.data.token, parsed.data.password);
    return jsonOk({ reset: true });
  } catch (err) {
    return handleError(err);
  }
}
