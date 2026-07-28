import { requireApiUser } from "@/server/auth/api";
import { isStaffOrAdmin } from "@/server/auth/rbac";
import {
  getDashboardStats,
  getTopProducts,
  getProviderPerformance,
} from "@/server/reports/service";
import { handleError, jsonOk, jsonError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * إحصائيات لوحة النظرة العامة.
 * تُجلب من الواجهة عبر fetch بدل تنفيذها داخل عرض صفحة /admin —
 * مسارات الـ API أثبتت صلابتها في بيئة serverless بينما كان تجميع
 * 11 استعلامًا داخل عرض RSC هشًّا (إجهاض العرض يُيتّم الاستعلامات).
 */
export async function GET() {
  try {
    const user = await requireApiUser();
    if (!isStaffOrAdmin(user)) {
      return jsonError("غير مصرّح بالوصول.", 403);
    }
    const [stats, top, providers] = await Promise.all([
      getDashboardStats(),
      getTopProducts(6),
      getProviderPerformance(),
    ]);
    return jsonOk({ stats, top, providers });
  } catch (err) {
    return handleError(err);
  }
}
