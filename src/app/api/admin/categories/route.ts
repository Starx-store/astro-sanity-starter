import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { createCategory } from "@/server/catalog/service";
import { categorySchema } from "@/server/validation/catalog";
import { handleError, jsonOk, parseBody } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireApiPermission(PERMISSIONS.productsEdit);
    const parsed = await parseBody(req, categorySchema);
    if (!parsed.success) return parsed.response;

    const category = await createCategory(parsed.data);
    return jsonOk({ category }, 201);
  } catch (err) {
    return handleError(err);
  }
}
