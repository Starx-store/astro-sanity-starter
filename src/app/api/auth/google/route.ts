import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/server/auth/google";
import { isSafePath } from "@/lib/safe-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** يبدأ تدفّق تسجيل الدخول بجوجل. */
export async function GET(req: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=google_off", req.url),
    );
  }
  const url = new URL(req.url);
  const nextParam = url.searchParams.get("next") || "/account";
  // مسار داخلي فقط — "//evil.com" يبدأ بـ "/" لكنه نطاق خارجي.
  const next = isSafePath(nextParam) ? nextParam : "/account";

  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("g_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  jar.set("g_next", next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
