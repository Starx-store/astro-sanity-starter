import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";
import {
  users,
  wallets,
  verifications,
  passwordResets,
  type User,
} from "@/server/db/schema";
import { hashPassword, verifyPassword } from "./password";
import {
  generateOtp,
  generateResetToken,
  hashToken,
} from "./tokens";
import { createSession, revokeAllSessions } from "./session";
import { verifyLoginTotp } from "./twofactor";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  isEmailConfigured,
} from "@/server/email";
import { appBaseUrl } from "@/server/base-url";
import {
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  OTP_TTL_MS,
  RESET_TTL_MS,
} from "./constants";
import type { RegisterInput } from "@/server/validation/auth";
import { linkReferral, ensureReferralCode, findUserByReferralCode, getTraderReferralCode } from "@/server/referrals/service";

export class AuthError extends AppError {}

/**
 * تسجيل مستخدم جديد: ينشئ المستخدم + محفظته + رمز تحقق البريد، ثم يفتح جلسة.
 * كل ذلك داخل معاملة قاعدة بيانات واحدة.
 * يُعاد رمز OTP في بيئة التطوير فقط (ليُرسل عبر البريد في المراحل التالية).
 */
export async function registerUser(
  input: RegisterInput,
): Promise<{ user: User; needsVerification: boolean }> {
  const email = input.email.toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    throw new AuthError("email_taken", "هذا البريد مسجّل مسبقًا.", 409);
  }

  const passwordHash = await hashPassword(input.password);
  // تحقق البريد يُفعّل تلقائيًا فقط عندما يكون SMTP مضبوطًا؛ وإلا يُفعّل الحساب
  // فورًا (كي لا يعلق التسجيل بلا وسيلة إرسال).
  const requireVerification = isEmailConfigured();
  const otp = requireVerification ? generateOtp() : null;

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        name: input.name,
        email,
        phone: input.phone ? input.phone : null,
        passwordHash,
        emailVerifiedAt: requireVerification ? null : new Date(),
      })
      .returning();

    await tx.insert(wallets).values({ userId: user.id, currency: "USD" });

    if (otp) {
      await tx.insert(verifications).values({
        userId: user.id,
        channel: "email",
        codeHash: hashToken(otp),
        target: email,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      });
    }

    return user;
  });

  // Handle referral logic
  await ensureReferralCode(created.id);
  
  if (input.referralCode) {
    const traderCode = await getTraderReferralCode();
    if (traderCode && traderCode.toUpperCase() === input.referralCode.toUpperCase()) {
      await db.update(users).set({ isTrader: true }).where(eq(users.id, created.id));
    }
    
    const referrer = await findUserByReferralCode(input.referralCode);
    if (referrer) {
      await linkReferral(referrer.id, created.id);
    }
  }

  // نفتح الجلسة فورًا (المستخدم مسجّل الدخول لكن قد يحتاج تأكيد البريد).
  await createSession(created.id);
  if (otp) await sendVerificationEmail(email, otp);

  return { user: created, needsVerification: requireVerification };
}

/**
 * تسجيل الدخول مع حماية من التكرار (قفل مؤقت بعد محاولات فاشلة).
 */
export async function loginUser(input: {
  email: string;
  password: string;
  totp?: string;
}): Promise<User> {
  const email = input.email.toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // رسالة موحّدة لعدم كشف وجود الحساب.
  const invalid = () =>
    new AuthError("invalid_credentials", "البريد أو كلمة المرور غير صحيحة.", 401);

  if (!user) {
    // نفّذ تجزئة وهمية لتقليل فروق التوقيت (اختياري مبسّط).
    await verifyPassword(input.password, "$2a$12$" + "x".repeat(53));
    throw invalid();
  }

  if (user.status === "banned") {
    throw new AuthError("banned", "هذا الحساب محظور.", 403);
  }

  // حساب أُنشئ عبر جوجل بلا كلمة مرور — يُوجَّه لتسجيل الدخول بجوجل.
  if (!user.passwordHash) {
    throw new AuthError(
      "use_google",
      "هذا الحساب مسجّل عبر جوجل — استخدم زر «الدخول بجوجل».",
      401,
    );
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthError(
      "locked",
      "تم قفل الحساب مؤقتًا بسبب محاولات كثيرة. حاول لاحقًا.",
      429,
    );
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const locked =
      failed >= MAX_FAILED_LOGINS
        ? new Date(Date.now() + LOCK_DURATION_MS)
        : null;
    await db
      .update(users)
      .set({ failedLoginCount: failed, lockedUntil: locked })
      .where(eq(users.id, user.id));
    throw invalid();
  }

  // كلمة المرور صحيحة — تحقق المصادقة الثنائية إن كانت مفعّلة قبل فتح الجلسة.
  if (user.twoFactorEnabled) {
    if (!input.totp) {
      throw new AuthError(
        "2fa_required",
        "أدخل رمز المصادقة الثنائية من التطبيق.",
        401,
      );
    }
    if (!verifyLoginTotp(user, input.totp)) {
      throw new AuthError("2fa_invalid", "رمز المصادقة الثنائية غير صحيح.", 401);
    }
  }

  // نجاح: صفّر العدّاد وسجّل الدخول.
  await db
    .update(users)
    .set({
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await createSession(user.id);
  return user;
}

/**
 * تأكيد بريد المستخدم عبر رمز OTP.
 */
export async function verifyEmailOtp(
  userId: string,
  code: string,
): Promise<void> {
  const now = new Date();
  const [record] = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, userId),
        eq(verifications.channel, "email"),
        isNull(verifications.usedAt),
        gt(verifications.expiresAt, now),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1);

  if (!record) {
    throw new AuthError("otp_expired", "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.");
  }
  if (record.attempts >= 5) {
    throw new AuthError("otp_attempts", "تجاوزت عدد المحاولات المسموحة.");
  }

  if (record.codeHash !== hashToken(code)) {
    await db
      .update(verifications)
      .set({ attempts: record.attempts + 1 })
      .where(eq(verifications.id, record.id));
    throw new AuthError("otp_invalid", "رمز التحقق غير صحيح.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(verifications)
      .set({ usedAt: now })
      .where(eq(verifications.id, record.id));
    await tx
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, userId));
  });
}

/**
 * إعادة إرسال رمز تحقق البريد: يُبطل الرموز السابقة غير المستخدمة ويولّد رمزًا جديدًا.
 * يُعاد الرمز (devOtp) في بيئة التطوير فقط، ويُطبع في سجلّ الخادم أيضًا.
 */
export async function resendEmailOtp(
  userId: string,
): Promise<{ devOtp?: string; alreadyVerified?: boolean }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AuthError("not_found", "المستخدم غير موجود.", 404);
  if (user.emailVerifiedAt) return { alreadyVerified: true };

  const otp = generateOtp();
  await db.transaction(async (tx) => {
    // إبطال الرموز السابقة غير المستخدمة.
    await tx
      .update(verifications)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(verifications.userId, userId),
          eq(verifications.channel, "email"),
          isNull(verifications.usedAt),
        ),
      );
    await tx.insert(verifications).values({
      userId,
      channel: "email",
      codeHash: hashToken(otp),
      target: user.email,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
  });

  // إرسال الرمز فعليًا بالبريد (يتجاهل بأمان إن لم يُضبط SMTP).
  await sendVerificationEmail(user.email, otp);

  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] رمز تحقق البريد لـ ${user.email}: ${otp}`);
  }
  return { devOtp: process.env.NODE_ENV !== "production" ? otp : undefined };
}

/**
 * إنشاء طلب استعادة كلمة المرور. يُعاد الرمز في التطوير فقط.
 * لا نكشف ما إذا كان البريد موجودًا (حماية من التعداد).
 */
export async function requestPasswordReset(
  emailRaw: string,
): Promise<{ devToken?: string }> {
  const email = emailRaw.toLowerCase();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return {};

  const token = generateResetToken();
  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });

  // إرسال رابط الاستعادة بالبريد — send لا ترمي أخطاء فلا يتعطل المسار.
  await sendPasswordResetEmail(
    email,
    `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`,
  );

  return {
    devToken: process.env.NODE_ENV !== "production" ? token : undefined,
  };
}

/**
 * إعادة تعيين كلمة المرور عبر رمز صالح، ثم إنهاء كل الجلسات.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const [record] = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHash),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, now),
      ),
    )
    .limit(1);

  if (!record) {
    throw new AuthError("reset_invalid", "رابط الاستعادة غير صالح أو منتهٍ.");
  }

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, record.userId));
    await tx
      .update(passwordResets)
      .set({ usedAt: now })
      .where(eq(passwordResets.id, record.id));
  });

  await revokeAllSessions(record.userId);
}

export async function changeUserPassword(
  userId: string,
  input: { currentPassword?: string; newPassword: string },
): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.passwordHash) {
    throw new AuthError("user_not_found", "المستخدم غير موجود.", 404);
  }

  if (input.currentPassword) {
    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AuthError("invalid_password", "كلمة المرور الحالية غير صحيحة.", 400);
    }
  }

  const newHash = await hashPassword(input.newPassword);
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, userId));
  await revokeAllSessions(userId);
}

