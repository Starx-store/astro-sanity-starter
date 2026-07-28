import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { unlinkProduct } from "@/server/providers/service";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/** إزالة ربط منتج بمزوّد. */
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.providersManage);
    if (!isUuid(params.id)) return jsonError("الرابط غير موجود.", 404);
    await unlinkProduct(params.id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
