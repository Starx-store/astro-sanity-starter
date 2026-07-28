import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { testProviderConnection } from "@/server/providers/service";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/** اختبار اتصال المزوّد — من الخادم فقط (الأسرار لا تصل الواجهة). */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.providersManage);
    if (!isUuid(params.id)) return jsonError("المزوّد غير موجود.", 404);
    const result = await testProviderConnection(params.id);
    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
