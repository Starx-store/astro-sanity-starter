import { requireUser } from "@/server/auth/current-user";
import { generateUserApiKey, getUserApiKey } from "@/server/api-keys/service";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const key = await getUserApiKey(user.id);
    return jsonOk({ apiKey: key });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const key = await generateUserApiKey(user.id);
    return jsonOk({ apiKey: key });
  } catch (err) {
    return handleError(err);
  }
}
