import { requireApiPermission, getRequestIp } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { adminAdjustWallet } from "@/server/wallet/service";
import { walletAdjustSchema } from "@/server/validation/wallet";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/** إضافة/خصم رصيد لمستخدم — يتطلب صلاحية wallet.adjust، ويُسجَّل في التدقيق. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireApiPermission(PERMISSIONS.walletAdjust);

    if (!isUuid(params.id)) return jsonError("المستخدم غير موجود.", 404);
    // منع شحن الذات: من يملك الصلاحية لا يزيد رصيده بنفسه.
    if (params.id === admin.id) {
      return jsonError("لا يمكنك تعديل رصيد حسابك.", 409);
    }

    const parsed = await parseBody(req, walletAdjustSchema);
    if (!parsed.success) return parsed.response;

    const entry = await adminAdjustWallet({
      targetUserId: params.id,
      direction: parsed.data.direction,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      performedBy: admin.id,
      ip: await getRequestIp(),
    });

    return jsonOk({
      transaction: {
        id: entry.id,
        referenceNo: entry.referenceNo,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
