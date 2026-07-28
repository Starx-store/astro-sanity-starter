import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { updateCategory, deleteCategory } from "@/server/catalog/service";
import { categorySchema } from "@/server/validation/catalog";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.productsEdit);
    if (!isUuid(params.id)) return jsonError("التصنيف غير موجود.", 404);

    const parsed = await parseBody(req, categorySchema);
    if (!parsed.success) return parsed.response;

    const category = await updateCategory(params.id, parsed.data);
    return jsonOk({ category });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.productsEdit);
    if (!isUuid(params.id)) return jsonError("التصنيف غير موجود.", 404);

    await deleteCategory(params.id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
