import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * TOTP (RFC 6238) وHOTP (RFC 4226) بلا اعتماديات خارجية — HMAC-SHA1، 6 خانات، خطوة 30ث.
 * السر بترميز Base32 (RFC 4648) متوافق مع Google Authenticator وغيره.
 */

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("سر Base32 غير صالح.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** توليد سر عشوائي (افتراضي 20 بايت = 160 بت) بترميز Base32. */
export function generateBase32Secret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  // كتابة العدّاد 64-بت (big-endian) بأمان دون تجاوز 32-بت.
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, "0");
}

export interface TotpOptions {
  step?: number;
  digits?: number;
  t0?: number;
  /** الزمن بالمللي ثانية (للاختبار). */
  nowMs?: number;
}

export function totp(base32Secret: string, opts: TotpOptions = {}): string {
  const { step = 30, digits = 6, t0 = 0, nowMs = Date.now() } = opts;
  const counter = Math.floor((Math.floor(nowMs / 1000) - t0) / step);
  return hotp(base32Decode(base32Secret), counter, digits);
}

/**
 * تحقق من رمز مع نافذة تسامح (±window خطوات) لفروق الساعة.
 * مقارنة ثابتة الزمن ضد هجمات التوقيت.
 */
export function verifyTotp(
  base32Secret: string,
  token: string,
  opts: TotpOptions & { window?: number } = {},
): boolean {
  const { step = 30, digits = 6, t0 = 0, nowMs = Date.now(), window = 1 } = opts;
  const cleaned = (token ?? "").replace(/\s/g, "");
  if (!/^\d{6,8}$/.test(cleaned)) return false;

  const secret = base32Decode(base32Secret);
  const base = Math.floor((Math.floor(nowMs / 1000) - t0) / step);
  for (let w = -window; w <= window; w++) {
    const candidate = hotp(secret, base + w, digits);
    if (
      candidate.length === cleaned.length &&
      timingSafeEqual(Buffer.from(candidate), Buffer.from(cleaned))
    ) {
      return true;
    }
  }
  return false;
}

/** رابط otpauth:// لإضافته في تطبيق المصادقة (يدويًا أو عبر QR). */
export function otpauthUrl(
  secret: string,
  accountLabel: string,
  issuer = "Evo Store",
): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
