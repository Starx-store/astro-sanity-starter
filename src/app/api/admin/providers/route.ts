import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { createProvider } from "@/server/providers/service";
import { providerSchema } from "@/server/validation/providers";
import { handleError, jsonOk, parseBody } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireApiPermission(PERMISSIONS.providersManage);
    const parsed = await parseBody(req, providerSchema);
    if (!parsed.success) return parsed.response;

    const id = await createProvider(parsed.data);
    return jsonOk({ id }, 201);
  } catch (err) {
    return handleError(err);
  }
}
