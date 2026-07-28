import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { setSetting } from "@/server/settings/service";
import { settingsSchema } from "@/server/validation/settings";
import { handleError, jsonOk, parseBody } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    const parsed = await parseBody(req, settingsSchema);
    if (!parsed.success) return parsed.response;

    await Promise.all([
      setSetting("store.name", parsed.data.storeName),
      setSetting("store.currency", parsed.data.currency),
      setSetting("store.min_deposit", parsed.data.minDeposit),
      setSetting("store.maintenance", parsed.data.maintenance),
      setSetting("tiers.silver_discount", parsed.data.silverDiscount),
      setSetting("tiers.gold_discount", parsed.data.goldDiscount),
      setSetting("currencies.sar_rate", parsed.data.sarRate),
      setSetting("currencies.yers_rate", parsed.data.yersRate),
      setSetting("currencies.yero_rate", parsed.data.yeroRate),
      setSetting("crypto.bep20_address", parsed.data.bep20Address),
      setSetting("crypto.min_confirmations", parsed.data.cryptoMinConfirmations),
      setSetting("support.whatsapp", parsed.data.supportWhatsapp),
      setSetting("store.logo", parsed.data.logo),
      setSetting("referral.trader_code", parsed.data.traderReferralCode),
      setSetting("store.whatsapp", parsed.data["store.whatsapp"] ?? ""),
      setSetting("store.meta_description", parsed.data["store.meta_description"] ?? ""),
      setSetting("announcement.enabled", parsed.data["announcement.enabled"] ?? false),
      setSetting("announcement.text_ar", parsed.data["announcement.text_ar"] ?? ""),
      setSetting("announcement.text_en", parsed.data["announcement.text_en"] ?? ""),
      setSetting("announcement.link", parsed.data["announcement.link"] ?? ""),
      setSetting("announcement.badge", parsed.data["announcement.badge"] ?? ""),
    ]);
    return jsonOk({ saved: true });
  } catch (err) {
    return handleError(err);
  }
}
