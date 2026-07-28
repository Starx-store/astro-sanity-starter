import { getSessionUser } from "@/server/auth/session";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSessionUser();
    return jsonOk({ user });
  } catch (err) {
    return handleError(err);
  }
}
