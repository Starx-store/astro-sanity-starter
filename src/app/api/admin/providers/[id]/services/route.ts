import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { searchProviderCatalog } from "@/server/providers/catalog";
import { handleError, jsonOk, jsonError } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// جلب كتالوج ضخم لأول مرة قد يستغرق حتى دقيقة.
export const maxDuration = 120;

/** تصفّح كتالوج خدمات المزوّد (بحث + صفحات على الخادم). */
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireApiPermission(PERMISSIONS.providersManage);
    if (!isUuid(params.id)) return jsonError("المزوّد غير موجود.", 404);

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";
    // التصفّح رخيص (من الكاش)، أما التحديث القسري فيجلب ميجابايتات من المزوّد.
    await enforceRateLimit({
      key: refresh ? "provider-catalog-refresh" : "provider-catalog",
      limit: refresh ? 5 : 60,
      windowMs: 60_000,
      identifier: admin.id,
    });

    const result = await searchProviderCatalog(params.id, {
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1) || 1,
      pageSize: Number(url.searchParams.get("pageSize") ?? 30) || 30,
      refresh,
    });
    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
