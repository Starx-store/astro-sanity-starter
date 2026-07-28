import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

/**
 * تشفير أسرار المزوّدين at-rest بـ AES-256-GCM.
 *
 * المفتاح يُشتق بـ scrypt من PROVIDER_ENCRYPTION_KEY (يُفضّل)، أو من
 * SESSION_SECRET كحل احتياطي حتى يعمل النظام دون إعداد إضافي.
 * الصيغة المخزّنة: v1:<salt>:<iv>:<tag>:<ciphertext> (كلها base64).
 *
 * ملاحظة: تغيير المفتاح لاحقًا يتطلب إعادة تشفير القيم القديمة.
 */

const VERSION = "v1";

function masterSecret(): string {
  const key = process.env.PROVIDER_ENCRYPTION_KEY?.trim();
  if (key && key.length >= 16) return key;
  const fallback = process.env.SESSION_SECRET?.trim();
  if (fallback && fallback.length >= 16) {
    return `evo-provider::${fallback}`;
  }
  throw new Error(
    "لا يوجد مفتاح تشفير — عرّف PROVIDER_ENCRYPTION_KEY أو SESSION_SECRET في البيئة.",
  );
}

function deriveKey(salt: Buffer): Buffer {
  return scryptSync(masterSecret(), salt, 32);
}

export function encryptSecret(plain: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 5 || parts[0] !== VERSION) {
    throw new Error("صيغة السر المشفّر غير صالحة.");
  }
  const [, saltB64, ivB64, tagB64, dataB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const key = deriveKey(salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** إخفاء سر للعرض (آخر 4 خانات فقط) — لا يُعاد السر الخام للواجهة أبدًا. */
export function maskSecret(plain: string): string {
  if (plain.length <= 4) return "••••";
  return `••••${plain.slice(-4)}`;
}
