import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import {
  isBinanceEnabled,
  fetchBinanceCertificates,
} from "@/server/payments/binance/client";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * فحص اتصال Binance Pay (أدمن) — استدعاء موقّع للتحقق من صحة المفاتيح
 * دون كشفها. نستخدم نقطة الشهادات (قراءة فقط) كاختبار مصادقة.
 */
export async function POST() {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    if (!isBinanceEnabled()) {
      return jsonOk({
        ok: false,
        configured: false,
        message: "مفاتيح Binance غير مضبوطة في البيئة.",
      });
    }
    try {
      const certs = await fetchBinanceCertificates();
      return jsonOk({
        ok: true,
        configured: true,
        message: `الاتصال بـ Binance Pay ناجح (${certs.length} شهادة).`,
      });
    } catch (e) {
      return jsonOk({
        ok: false,
        configured: true,
        message:
          e instanceof Error
            ? `فشل الاتصال: ${e.message}`
            : "فشل الاتصال بـ Binance.",
      });
    }
  } catch (err) {
    return handleError(err);
  }
}
