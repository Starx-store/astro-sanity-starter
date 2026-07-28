import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { users, wallets } from "@/server/db/schema";
import { AuthError } from "./service";
import { createSession } from "./session";
import { appBaseUrl } from "@/server/base-url";

/**
 * تسجيل الدخول عبر Google (OAuth 2.0 — Authorization Code).
 *
 * الإعداد المطلوب (Vercel → Environment Variables):
 * - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET من Google Cloud Console
 * - عنوان إعادة التوجيه المصرّح به في Google:
 *     https://evo-storex.com/api/auth/google/callback
 * غير مضبوط ⇒ الزر لا يظهر والمسارات ترفض بلطف.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function clientId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
}

export function isGoogleConfigured(): boolean {
  return Boolean(clientId() && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  // يجب أن يطابق العنوان المسجّل لدى جوجل حرفيًا.
  return `${appBaseUrl()}/api/auth/google/callback`;
}

/** رابط بدء المصادقة لدى جوجل (مع state لمنع CSRF). */
export function buildGoogleAuthUrl(state: string, next?: string): string {
  const params = new URLSearchParams({
    client_id: clientId()!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  if (next) params.set("login_hint", "");
  return `${AUTH_URL}?${params.toString()}`;
}

interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** يفكّ حمولة id_token (JWT) دون تحقق توقيع — آمن لأنه ورد مباشرة من جوجل عبر TLS. */
function decodeIdToken(idToken: string): GoogleProfile {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new AuthError("google_failed", "رمز جوجل غير صالح.", 502);
  const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
  return {
    sub: String(json.sub),
    email: String(json.email ?? "").toLowerCase(),
    emailVerified: json.email_verified === true || json.email_verified === "true",
    name: String(json.name ?? json.email ?? "مستخدم"),
  };
}

/** تبادل الكود برمز وصول ثم جلب هوية المستخدم. */
async function exchangeCode(code: string): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    code,
    client_id: clientId()!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new AuthError("google_failed", "تعذّر الاتصال بجوجل.", 502);
  }
  const json = (await res.json().catch(() => null)) as {
    id_token?: string;
    error?: string;
  } | null;
  if (!json || !json.id_token) {
    throw new AuthError("google_failed", "فشل تبادل رمز جوجل.", 502);
  }
  return decodeIdToken(json.id_token);
}

/**
 * إتمام تسجيل الدخول بجوجل: ينشئ جلسة ويعيد المستخدم.
 * يربط بحساب موجود بنفس البريد، أو ينشئ حسابًا جديدًا مفعّلًا.
 */
export async function loginWithGoogle(code: string): Promise<{ userId: string }> {
  const profile = await exchangeCode(code);
  if (!profile.email) {
    throw new AuthError("google_no_email", "حساب جوجل بلا بريد.", 400);
  }
  // بريد غير مُتحقَّق لدى جوجل لا يُوثق به: الربط بالبريد أو إنشاء حساب
  // مفعّل به يسمح بالاستيلاء على حساب قائم بنفس العنوان.
  if (!profile.emailVerified) {
    throw new AuthError(
      "google_unverified",
      "بريد حساب جوجل غير مُتحقَّق — أكّده لدى جوجل ثم أعد المحاولة.",
      403,
    );
  }

  // 1) مطابقة بمعرّف جوجل
  const [byGoogle] = await db
    .select()
    .from(users)
    .where(eq(users.googleId, profile.sub))
    .limit(1);
  if (byGoogle) {
    if (byGoogle.status === "banned") {
      throw new AuthError("account_disabled", "هذا الحساب موقوف.", 403);
    }
    await createSession(byGoogle.id);
    return { userId: byGoogle.id };
  }

  // 2) مطابقة بالبريد — نربط جوجل بالحساب القائم
  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);
  if (byEmail) {
    if (byEmail.status === "banned") {
      throw new AuthError("account_disabled", "هذا الحساب موقوف.", 403);
    }
    await db
      .update(users)
      .set({
        googleId: profile.sub,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail.id));
    await createSession(byEmail.id);
    return { userId: byEmail.id };
  }

  // 3) حساب جديد (مفعّل فورًا — جوجل تحقّق البريد)
  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        name: profile.name.slice(0, 80),
        email: profile.email,
        passwordHash: null,
        googleId: profile.sub,
        emailVerifiedAt: new Date(),
      })
      .returning();
    await tx.insert(wallets).values({ userId: user.id, currency: "USD" });
    return user;
  });

  await createSession(created.id);
  return { userId: created.id };
}
