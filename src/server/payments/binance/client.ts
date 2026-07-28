import "server-only";
import { createHmac, randomBytes } from "crypto";
import { AppError } from "@/server/errors";

/**
 * عميل Binance Pay Merchant API.
 *
 * الطلبات الصادرة تُوقَّع HMAC-SHA512 على النص:
 *   timestamp + "\n" + nonce + "\n" + body + "\n"
 * وتُرسل الترويسات: BinancePay-Timestamp / Nonce / Certificate-SN (مفتاح API) / Signature.
 * الأسرار من متغيرات البيئة الخادمية فقط — لا تصل الواجهة أبدًا.
 */

const DEFAULT_BASE_URL = "https://bpay.binanceapi.com";

export function isBinanceEnabled(): boolean {
  return Boolean(
    process.env.BINANCE_PAY_API_KEY && process.env.BINANCE_PAY_API_SECRET,
  );
}

function credentials() {
  const apiKey = process.env.BINANCE_PAY_API_KEY;
  const apiSecret = process.env.BINANCE_PAY_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new AppError(
      "binance_disabled",
      "الدفع عبر Binance Pay غير مفعّل حاليًا.",
      503,
    );
  }
  return {
    apiKey,
    apiSecret,
    baseUrl: process.env.BINANCE_PAY_BASE_URL?.trim() || DEFAULT_BASE_URL,
  };
}

/** توقيع الطلب الصادر (HMAC-SHA512، hex بأحرف كبيرة). */
export function signOutgoing(payload: string, secret: string): string {
  return createHmac("sha512", secret).update(payload).digest("hex").toUpperCase();
}

interface BinanceApiEnvelope<T> {
  status?: string;
  code?: string;
  data?: T;
  errorMessage?: string;
}

async function binanceRequest<T>(path: string, body: unknown): Promise<T> {
  const { apiKey, apiSecret, baseUrl } = credentials();
  const timestamp = String(Date.now());
  const nonce = randomBytes(16).toString("hex"); // 32 حرفًا أبجدية رقمية
  const bodyStr = JSON.stringify(body ?? {});
  const signature = signOutgoing(
    `${timestamp}\n${nonce}\n${bodyStr}\n`,
    apiSecret,
  );

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": apiKey,
        "BinancePay-Signature": signature,
      },
      body: bodyStr,
      cache: "no-store",
    });
  } catch {
    throw new AppError(
      "binance_unreachable",
      "تعذّر الاتصال بـ Binance Pay — حاول بعد قليل.",
      502,
    );
  }

  const json = (await res
    .json()
    .catch(() => null)) as BinanceApiEnvelope<T> | null;

  if (!json) {
    throw new AppError(
      "binance_bad_response",
      "استجابة غير مفهومة من Binance Pay.",
      502,
    );
  }
  if (json.status !== "SUCCESS" || json.code !== "000000" || !json.data) {
    console.error(
      `[binance] API error on ${path}: code=${json.code} msg=${json.errorMessage}`,
    );
    throw new AppError(
      "binance_error",
      `رفض Binance Pay العملية (${json.code ?? "غير معروف"}).`,
      502,
    );
  }
  return json.data;
}

/* ------------------------------------------------------------------ */
/*  العمليات                                                           */
/* ------------------------------------------------------------------ */

export interface BinanceOrderCreated {
  prepayId: string;
  terminalType?: string;
  expireTime?: number;
  qrcodeLink?: string;
  qrContent?: string;
  checkoutUrl?: string;
  deeplink?: string;
  universalUrl?: string;
}

/** إنشاء أمر دفع (v2). المبلغ نص عشري؛ العملة الافتراضية USDT. */
export async function createBinanceOrder(params: {
  merchantTradeNo: string;
  amount: string;
  currency?: string;
  description: string;
}): Promise<BinanceOrderCreated> {
  return binanceRequest<BinanceOrderCreated>("/binancepay/openapi/v2/order", {
    env: { terminalType: "WEB" },
    merchantTradeNo: params.merchantTradeNo,
    orderAmount: Number(params.amount),
    currency: params.currency ?? "USDT",
    goods: {
      goodsType: "02",
      goodsCategory: "Z000",
      referenceGoodsId: "evo-wallet-topup",
      goodsName: "Evo Store Wallet Top-up",
      goodsDetail: params.description,
    },
  });
}

export type BinanceOrderStatus =
  | "INITIAL"
  | "PENDING"
  | "PAID"
  | "CANCELED"
  | "ERROR"
  | "REFUNDING"
  | "REFUNDED"
  | "EXPIRED";

export interface BinanceOrderInfo {
  merchantTradeNo: string;
  prepayId?: string;
  transactionId?: string;
  status: BinanceOrderStatus;
  currency?: string;
  orderAmount?: string | number;
  transactTime?: number;
}

/** استعلام حالة أمر دفع بمعرّف التاجر. */
export async function queryBinanceOrder(
  merchantTradeNo: string,
): Promise<BinanceOrderInfo> {
  return binanceRequest<BinanceOrderInfo>(
    "/binancepay/openapi/v2/order/query",
    { merchantTradeNo },
  );
}

export interface BinanceCertificate {
  certSerial: string;
  certPublic: string;
}

/** جلب المفاتيح العامة للتحقق من توقيعات Webhook. */
export async function fetchBinanceCertificates(): Promise<BinanceCertificate[]> {
  return binanceRequest<BinanceCertificate[]>(
    "/binancepay/openapi/certificates",
    {},
  );
}
