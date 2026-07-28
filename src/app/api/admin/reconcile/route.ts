import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { reconcileAllWallets } from "@/server/wallet/reconcile";
import { handleError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

/** مطابقة أرصدة المحافظ مع القيود — يتطلب صلاحية wallet.adjust. */
export async function POST() {
  try {
    await requireApiPermission(PERMISSIONS.walletAdjust);
    const result = await reconcileAllWallets();
    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
