import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, type User } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { encryptSecret, decryptSecret } from "@/server/crypto";
import {
  generateBase32Secret,
  otpauthUrl,
  verifyTotp,
} from "@/lib/totp";

/**
 * المصادقة الثنائية (TOTP). السر يُخزّن مشفّرًا at-rest في users.two_factor_secret،
 * ولا يُفعّل إلا بعد إثبات المستخدم لرمز صحيح (enable).
 */

/** بدء التسجيل: يولّد سرًّا ويخزّنه مشفّرًا (غير مفعّل بعد). يعيد السر ورابط otpauth. */
export async function setupTwoFactor(
  userId: string,
): Promise<{ secret: string; otpauthUrl: string }> {
  const [user] = await db
    .select({ email: users.email, enabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AppError("not_found", "المستخدم غير موجود.", 404);
  if (user.enabled) {
    throw new AppError("already_enabled", "المصادقة الثنائية مفعّلة مسبقًا.", 409);
  }

  const secret = generateBase32Secret();
  await db
    .update(users)
    .set({ twoFactorSecret: encryptSecret(secret), twoFactorEnabled: false })
    .where(eq(users.id, userId));

  return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
}

/** تفعيل بعد التحقق من رمز من التطبيق. */
export async function enableTwoFactor(
  userId: string,
  code: string,
): Promise<void> {
  const [user] = await db
    .select({ secret: users.twoFactorSecret, enabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.secret) {
    throw new AppError("no_setup", "ابدأ إعداد المصادقة الثنائية أولًا.", 409);
  }
  if (user.enabled) return;

  const secret = decryptSecret(user.secret);
  if (!verifyTotp(secret, code)) {
    throw new AppError("otp_invalid", "الرمز غير صحيح.", 422, {
      code: "رمز غير صحيح — تأكد من التطبيق والوقت",
    });
  }
  await db
    .update(users)
    .set({ twoFactorEnabled: true })
    .where(eq(users.id, userId));
}

/** تعطيل بعد التحقق من رمز حالي. */
export async function disableTwoFactor(
  userId: string,
  code: string,
): Promise<void> {
  const [user] = await db
    .select({ secret: users.twoFactorSecret, enabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.enabled || !user.secret) {
    throw new AppError("not_enabled", "المصادقة الثنائية غير مفعّلة.", 409);
  }
  if (!verifyTotp(decryptSecret(user.secret), code)) {
    throw new AppError("otp_invalid", "الرمز غير صحيح.", 422, {
      code: "رمز غير صحيح",
    });
  }
  await db
    .update(users)
    .set({ twoFactorEnabled: false, twoFactorSecret: null })
    .where(eq(users.id, userId));
}

/** التحقق أثناء تسجيل الدخول (يستقبل صف المستخدم الكامل). */
export function verifyLoginTotp(user: User, code: string | undefined): boolean {
  if (!user.twoFactorSecret) return false;
  if (!code) return false;
  try {
    return verifyTotp(decryptSecret(user.twoFactorSecret), code);
  } catch {
    return false;
  }
}
