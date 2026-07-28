import "server-only";
import { createVerify } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { paymentEvents } from "@/server/db/schema";
import { fetchBinanceCertificates } from "./client";
import { creditBinanceDeposit, expireBinanceDeposit } from "./deposits";

/**
 * معالجة إشعارات Binance Pay (Webhook).
 *
 * التحقق من التوقيع (إلزامي قبل أي معالجة):
 *   payload = timestamp + "\n" + nonce + "\n" + rawBody + "\n"
 *   يُفك BinancePay-Signature من Base64 ويُتحقق RSA-SHA256
 *   بالمفتاح العام من Query Certificate API (مع كاش وتحديث إجباري عند الفشل).
 *
 * الرد المطلوب لدى النجاح: HTTP 200 مع {"returnCode":"SUCCESS","returnMessage":null}
 * وإلا يعيد Binance المحاولة — لذلك المعالجة كلها Idempotent.
 */

interface CachedCerts {
  certs: { serial: string; publicKeyPem: string }[];
  fetchedAt: number;
}

let certCache: CachedCerts | null = null;
const CERT_TTL_MS = 6 * 60 * 60 * 1000; // 6 ساعات

/** يلفّ المفتاح العام بصيغة PEM إن وصل خامًا (Base64 بلا ترويسات). */
export function toPublicKeyPem(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed;
  const body = trimmed.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`;
}

async function getCertificates(force = false) {
  if (!force && certCache && Date.now() - certCache.fetchedAt < CERT_TTL_MS) {
    return certCache.certs;
  }
  const data = await fetchBinanceCertificates();
  certCache = {
    certs: data.map((c) => ({
      serial: c.certSerial,
      publicKeyPem: toPublicKeyPem(c.certPublic),
    })),
    fetchedAt: Date.now(),
  };
  return certCache.certs;
}

function rsaSha256Verify(
  publicKeyPem: string,
  payload: string,
  signatureB64: string,
): boolean {
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(payload);
    verifier.end();
    return verifier.verify(publicKeyPem, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

/** تحقق توقيع إشعار وارد — يجرّب كل الشهادات، ويعيد الجلب مرة عند الفشل (تدوير مفاتيح). */
export async function verifyBinanceWebhookSignature(params: {
  timestamp: string;
  nonce: string;
  rawBody: string;
  signature: string;
}): Promise<boolean> {
  if (!params.signature || !params.timestamp || !params.nonce) return false;
  const payload = `${params.timestamp}\n${params.nonce}\n${params.rawBody}\n`;

  try {
    for (const cert of await getCertificates()) {
      if (rsaSha256Verify(cert.publicKeyPem, payload, params.signature)) {
        return true;
      }
    }
    for (const cert of await getCertificates(true)) {
      if (rsaSha256Verify(cert.publicKeyPem, payload, params.signature)) {
        return true;
      }
    }
  } catch (e) {
    console.error("[binance] فشل جلب شهادات التحقق:", e);
  }
  return false;
}

export interface WebhookResult {
  ok: boolean;
  reason?: string;
}

export async function processBinanceWebhook(params: {
  rawBody: string;
  timestamp: string;
  nonce: string;
  signature: string;
}): Promise<WebhookResult> {
  // 1) تحليل الجسم
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(params.rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const bizType = String(parsed.bizType ?? "");
  const bizStatus = String(parsed.bizStatus ?? "");
  let data: Record<string, unknown> = {};
  const rawData = parsed.data;
  if (typeof rawData === "string") {
    try {
      data = JSON.parse(rawData) as Record<string, unknown>;
    } catch {
      data = {};
    }
  } else if (rawData && typeof rawData === "object") {
    data = rawData as Record<string, unknown>;
  }

  const merchantTradeNo = String(
    data.merchantTradeNo ?? parsed.bizIdStr ?? parsed.bizId ?? "",
  );
  const eventType = bizStatus || bizType || "UNKNOWN";
  const externalId = merchantTradeNo || `no-ref-${params.nonce}`;

  // 2) تحقق التوقيع قبل أي معالجة
  const signatureValid = await verifyBinanceWebhookSignature({
    timestamp: params.timestamp,
    nonce: params.nonce,
    rawBody: params.rawBody,
    signature: params.signature,
  });

  // 3) خزّن الحدث الخام كما وصل (فريد على provider+external_id+event_type)
  await db
    .insert(paymentEvents)
    .values({
      provider: "binance",
      eventType,
      externalId,
      signatureValid,
      rawPayload: parsed,
      processed: false,
    })
    .onConflictDoNothing();

  if (!signatureValid) {
    console.error(
      `[binance] توقيع غير صالح لإشعار ${eventType} (${externalId})`,
    );
    return { ok: false, reason: "invalid_signature" };
  }

  // 4) المعالجة (idempotent بالكامل — التكرار آمن)
  let processed = true;
  if (bizType === "PAY" && bizStatus === "PAY_SUCCESS" && merchantTradeNo) {
    processed = await creditBinanceDeposit({
      merchantTradeNo,
      transactionId:
        data.transactionId != null ? String(data.transactionId) : null,
      via: "webhook",
    });
  } else if (bizType === "PAY" && bizStatus === "PAY_CLOSED" && merchantTradeNo) {
    await expireBinanceDeposit(merchantTradeNo, "CLOSED");
  }

  // 5) علّم الحدث كمُعالج
  await db
    .update(paymentEvents)
    .set({ processed })
    .where(
      and(
        eq(paymentEvents.provider, "binance"),
        eq(paymentEvents.externalId, externalId),
        eq(paymentEvents.eventType, eventType),
      ),
    );

  // نرد SUCCESS حتى لو كانت المعاملة غير معروفة محليًا (لإيقاف إعادة المحاولة)،
  // والحدث الخام محفوظ بعلم processed=false للتدقيق اليدوي.
  return { ok: true };
}
