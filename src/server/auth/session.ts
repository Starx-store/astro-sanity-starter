import "server-only";
import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { sessions, users, type User } from "@/server/db/schema";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "./constants";
import { generateSessionToken, hashToken } from "./tokens";

/**
 * إنشاء جلسة جديدة للمستخدم وتخزين تجزئة الرمز، ثم ضبط كوكي HttpOnly.
 * يُعاد الرمز الخام مرة واحدة فقط (لضبط الكوكي).
 */
export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent") ?? null;

  await db.insert(sessions).values({
    userId,
    tokenHash,
    ip,
    userAgent,
    expiresAt,
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export type SessionUser = Omit<User, "passwordHash" | "twoFactorSecret">;

/**
 * التحقق من الجلسة الحالية عبر الكوكي وإرجاع المستخدم (بدون الحقول الحسّاسة).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const rows = await db
    .select({ user: users, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  // الموقوف كالمحظور: لا جلسة فعّالة (وإلا مرّ عبر حرّاس الصفحات التي
  // تفحص الدور/الصلاحية فقط دون حالة الحساب).
  if (row.user.status !== "active") return null;

  // تحديث آخر ظهور (بدون انتظار حرج).
  await db
    .update(sessions)
    .set({ lastSeenAt: now })
    .where(eq(sessions.id, row.sessionId));

  const { passwordHash: _p, twoFactorSecret: _t, ...safe } = row.user;
  return safe;
}

/** إنهاء الجلسة الحالية (تسجيل الخروج). */
export async function destroySession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, tokenHash));
  }
  (await cookies()).delete(SESSION_COOKIE);
}

/** إنهاء كل جلسات المستخدم (مثلًا بعد تغيير كلمة المرور). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
