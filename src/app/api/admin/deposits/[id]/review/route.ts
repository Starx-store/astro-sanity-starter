import { requireApiPermission, getRequestIp } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { reviewDeposit } from "@/server/wallet/deposits";
import { depositReviewSchema } from "@/server/validation/wallet";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/** اعتماد أو رفض طلب شحن — يتطلب صلاحية deposits.review. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const admin = await requireApiPermission(PERMISSIONS.depositsReview);

    if (!isUuid(params.id)) return jsonError("طلب الشحن غير موجود.", 404);

    const parsed = await parseBody(req, depositReviewSchema);
    if (!parsed.success) return parsed.response;

    const result = await reviewDeposit({
      depositId: params.id,
      reviewerId: admin.id,
      action: parsed.data.action,
      reason: parsed.data.reason,
      ip: await getRequestIp(),
    });

    return jsonOk(result);
  } catch (err) {
    return handleError(err);
  }
}
