import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { updateProvider, deleteProvider } from "@/server/providers/service";
import { providerSchema } from "@/server/validation/providers";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.providersManage);
    if (!isUuid(params.id)) return jsonError("المزوّد غير موجود.", 404);
    const parsed = await parseBody(req, providerSchema);
    if (!parsed.success) return parsed.response;

    await updateProvider(params.id, parsed.data);
    return jsonOk({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.providersManage);
    if (!isUuid(params.id)) return jsonError("المزوّد غير موجود.", 404);
    await deleteProvider(params.id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
