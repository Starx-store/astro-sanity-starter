import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loginWithGoogle, isGoogleConfigured } from "@/server/auth/google";
import { enforceRateLimit } from "@/server/rate-limit";
import { isSafePath } from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** يستقبل رجوع جوجل، يتحقق من state، ينشئ الجلسة، ويعيد التوجيه. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${code}`, req.url));

  if (!isGoogleConfigured()) return fail("google_off");

  const jar = await cookies();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = jar.get("g_state")?.value;
  const next = jar.get("g_next")?.value || "/account";

  // تنظيف كوكيز الحالة دائمًا.
  jar.delete("g_state");
  jar.delete("g_next");

  if (url.searchParams.get("error")) return fail("google_denied");
  if (!code || !state || !savedState || state !== savedState) {
    return fail("google_state");
  }

  try {
    // نقطة غير مصادَق عليها تُجري نداءً شبكيًا خارجيًا لكل طلب.
    await enforceRateLimit({ key: "google-callback", limit: 20, windowMs: 60_000 });
    await loginWithGoogle(code);
  } catch {
    return fail("google_failed");
  }

  // مسار داخلي فقط: "//evil.com" يبدأ بـ "/" لكنه يُفسَّر كنطاق خارجي.
  const dest = isSafePath(next) ? next : "/account";
  return NextResponse.redirect(new URL(dest, req.url));
}
