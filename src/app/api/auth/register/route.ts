import { registerSchema } from "@/server/validation/auth";
import { registerUser } from "@/server/auth/service";
import { handleError, jsonOk, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseBody(req, registerSchema);
  if (!parsed.success) return parsed.response;

  try {
    await enforceRateLimit({ key: "register", limit: 6, windowMs: 10 * 60_000 });
    const { user, needsVerification } = await registerUser(parsed.data);
    return jsonOk(
      {
        user: { id: user.id, name: user.name, email: user.email },
        needsVerification,
      },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
