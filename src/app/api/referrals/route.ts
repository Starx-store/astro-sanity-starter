import { requireApiUser } from "@/server/auth/api";
import { getReferralStats, ensureReferralCode } from "@/server/referrals/service";
import { jsonOk, handleError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const code = await ensureReferralCode(user.id);
    const stats = await getReferralStats(user.id);
    
    return jsonOk({ code, stats });
  } catch (err) {
    return handleError(err);
  }
}
