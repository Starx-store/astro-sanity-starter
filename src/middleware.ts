import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/constants";

/**
 * فحص خفيف على الحافة (Edge):
 * - يمنع الوصول للوحة الإدارة دون كوكي جلسة (التحقق الكامل من الدور في تخطيط /admin).
 * - يحوّل المسجّلين بعيدًا عن صفحات المصادقة.
 * - يحقن ترويسة x-evo-path ليقرأها التخطيط الجذري (وضع الصيانة).
 * Middleware لا يصل قاعدة البيانات؛ لذا فرض الصيانة يتم في التخطيط الجذري.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ملاحظة: لا نحوّل صفحات المصادقة بناءً على مجرد وجود الكوكي —
  // كوكي بجلسة ميتة كان يسبب حلقة تحويل لا نهائية (login ⇄ account)
  // فيبدو الموقع «معلّقًا» لصاحب الكوكي وحده. صفحة الدخول نفسها تتحقق
  // من صلاحية الجلسة الفعلية وتحوّل المسجّلين.

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-evo-path", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // كل الصفحات عدا ملفات Next الثابتة وواجهات API والملفات ذات الامتداد.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.).*)"],
};
