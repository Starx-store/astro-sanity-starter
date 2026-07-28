import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { pollPendingProviderOrders } from "@/server/providers/fulfillment";
import { syncAllProviderPrices } from "@/server/providers/import";
import { expireStaleCryptoDeposits } from "@/server/wallet/crypto-deposits";
import { getSetting, setSetting } from "@/server/settings/service";

export const maxDuration = 300;

/** مزامنة أسعار المزوّدين كل 6 ساعات (الكرون يستدعينا كل دقيقة). */
const PRICE_SYNC_INTERVAL_MS = 6 * 60 * 60_000;

async function maybeSyncPrices(): Promise<{ priceSync?: unknown }> {
  const last = Number(await getSetting<number>("providers.last_price_sync", 0));
  if (Date.now() - last < PRICE_SYNC_INTERVAL_MS) return {};
  // نحجز النافذة قبل البدء كي لا تتوازى دورتان.
  await setSetting("providers.last_price_sync", Date.now());
  try {
    const r = await syncAllProviderPrices();
    return { priceSync: r };
  } catch (e) {
    console.error("[cron] price sync failed:", e);
    return { priceSync: { error: true } };
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * متابعة دورية للطلبات المعلّقة لدى المزوّدين.
 * محميّة بـ CRON_SECRET: أرسل الترويسة Authorization: Bearer <CRON_SECRET>
 * أو ?secret=<CRON_SECRET>. اربطها بمجدول (Vercel Cron / GitHub Actions / أي جدولة).
 */
async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET غير مضبوط." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const provided =
    auth?.replace(/^Bearer\s+/i, "").trim() ?? url.searchParams.get("secret");
  const a = Buffer.from(provided ?? "");
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false, error: "غير مصرّح." }, { status: 401 });
  }

  const result = await pollPendingProviderOrders(50);
  const priceSync = await maybeSyncPrices();
  // إنهاء طلبات الكريبتو المعلّقة القديمة لتحرير مبالغها الفريدة.
  let expiredCrypto = 0;
  try {
    expiredCrypto = await expireStaleCryptoDeposits();
  } catch (e) {
    console.error("[cron] expire crypto deposits failed:", e);
  }
  return NextResponse.json({ ok: true, ...result, ...priceSync, expiredCrypto });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
