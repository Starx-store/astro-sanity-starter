import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { syncProviderPrices } from "@/server/providers/import";
import { handleError, jsonOk, jsonError } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** مزامنة يدوية لأسعار منتجات هذا المزوّد مع أسعاره الحالية. */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.providersManage);
    if (!isUuid(params.id)) return jsonError("المزوّد غير موجود.", 404);
    const result = await syncProviderPrices(params.id);
    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
