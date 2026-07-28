import { loginSchema } from "@/server/validation/auth";
import { loginUser } from "@/server/auth/service";
import { handleError, jsonOk, parseBody } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await parseBody(req, loginSchema);
  if (!parsed.success) return parsed.response;

  try {
    await enforceRateLimit({ key: "login", limit: 15, windowMs: 5 * 60_000 });
    const user = await loginUser(parsed.data);
    return jsonOk({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return handleError(err);
  }
}
