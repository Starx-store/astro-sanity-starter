import { NextResponse } from "next/server";
import { processBinanceWebhook } from "@/server/payments/binance/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * نقطة استقبال إشعارات Binance Pay — عامة (بلا جلسة)،
 * محمية بتحقق التوقيع الإلزامي داخل المعالج.
 * تُضبط في بوابة تاجر Binance على: https://<نطاقك>/api/webhooks/binance
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const result = await processBinanceWebhook({
      rawBody,
      timestamp: req.headers.get("binancepay-timestamp") ?? "",
      nonce: req.headers.get("binancepay-nonce") ?? "",
      signature: req.headers.get("binancepay-signature") ?? "",
    });

    if (result.ok) {
      return NextResponse.json(
        { returnCode: "SUCCESS", returnMessage: null },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { returnCode: "FAIL", returnMessage: result.reason ?? "rejected" },
      { status: 400 },
    );
  } catch (err) {
    console.error("[binance] webhook handler error:", err);
    return NextResponse.json(
      { returnCode: "FAIL", returnMessage: "internal" },
      { status: 500 },
    );
  }
}
