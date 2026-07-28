import { destroySession } from "@/server/auth/session";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroySession();
    return jsonOk({ loggedOut: true });
  } catch (err) {
    return handleError(err);
  }
}
