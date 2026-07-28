import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { createProduct } from "@/server/catalog/service";
import { productSchema } from "@/server/validation/catalog";
import { handleError, jsonOk, parseBody } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireApiPermission(PERMISSIONS.productsEdit);
    const parsed = await parseBody(req, productSchema);
    if (!parsed.success) return parsed.response;

    const id = await createProduct(parsed.data);
    return jsonOk({ id }, 201);
  } catch (err) {
    return handleError(err);
  }
}
