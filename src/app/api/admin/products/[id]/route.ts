import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { updateProduct, deleteProduct } from "@/server/catalog/service";
import { productSchema } from "@/server/validation/catalog";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.productsEdit);
    if (!isUuid(params.id)) return jsonError("المنتج غير موجود.", 404);

    const parsed = await parseBody(req, productSchema);
    if (!parsed.success) return parsed.response;

    await updateProduct(params.id, parsed.data);
    return jsonOk({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.productsEdit);
    if (!isUuid(params.id)) return jsonError("المنتج غير موجود.", 404);

    const result = await deleteProduct(params.id);
    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
