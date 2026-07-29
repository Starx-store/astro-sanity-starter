import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/constants";

/**
 * فحص وتوجيه خفيف على الحافة (Edge):
 * 1) إعادة توجيه استعلامات SMM Panel التي تستهدف النطاق الرئيسي https://evo-storex.com مباشرة إلى /api/v2 دون إرجاع HTML.
 * 2) إصلاح التوجيه التلقائي في Next.js للشرطة المائلة في النهاية (/api/v2/) دون فقدان بيانات POST.
 * 3) حماية لوحة الإدارة /admin.
 */
export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // 1) SMM Panel Root Domain Proxy:
  // إذا قامت لوحة SMM بالربط عبر الرابط الرئيسي https://evo-storex.com
  // نقوم بتحويل الطلب داخلياً إلى /api/v2 ليرجع JSON بدلاً من صفحة HTML الرئيسية.
  if (
    pathname === "/" &&
    (req.method === "POST" ||
      searchParams.has("action") ||
      searchParams.has("key") ||
      searchParams.has("service"))
  ) {
    return NextResponse.rewrite(new URL("/api/v2" + searchParams.toString() ? `?${searchParams.toString()}` : "", req.url));
  }

  // 2) Handling trailing slash on API requests without 307/308 redirect
  if (pathname.endsWith("/") && pathname.startsWith("/api/")) {
    const cleanPath = pathname.replace(/\/+$/, "");
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return NextResponse.rewrite(new URL(`${cleanPath}${queryString}`, req.url));
  }

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-evo-path", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // كل الصفحات بما فيها / و /api للتعامل مع الفحص المباشر للمزودين.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
