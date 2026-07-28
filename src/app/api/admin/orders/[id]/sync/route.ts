import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import {
  pollProviderOrder,
  retryOrderDispatch,
  requestOrderRefill,
} from "@/server/providers/fulfillment";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * مزامنة طلب تلقائي: متابعة حالته لدى المزوّد، أو إعادة إرساله إن كان
 * عالقًا (needs_manual)، أو طلب إعادة تعبئة (refill) لطلب نقص.
 * body: { action: "sync" | "retry" | "refill" }
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.ordersManage);
    if (!isUuid(params.id)) return jsonError("الطلب غير موجود.", 404);

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action === "retry") {
      await retryOrderDispatch(params.id);
    } else if (body.action === "refill") {
      await requestOrderRefill(params.id);
    } else {
      await pollProviderOrder(params.id);
    }
    return jsonOk({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
