import "server-only";
import { randomBytes, createHash, randomInt } from "crypto";

/** رمز جلسة عشوائي مبهم (opaque) يُخزّن مجزّأً في قاعدة البيانات. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** رمز استعادة كلمة المرور (يُرسل للمستخدم، يُخزّن مجزّأً). */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** تجزئة SHA-256 للرموز قبل التخزين — لا نخزّن الرمز الخام أبدًا. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** رمز تحقق رقمي (OTP) من 6 خانات. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** رقم مرجعي فريد يظهر للمستخدم (طلبات/قيود/تذاكر). */
export function generateReferenceNo(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}
