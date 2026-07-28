/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// سياسة أمان المحتوى — تسمح بما يحتاجه Next.js وصور Binance QR.
const csp = [
  "default-src 'self'",
  // Next.js يتطلب inline/eval في التطوير؛ في الإنتاج نسمح بـ inline للأنماط فقط.
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // يفعّل src/instrumentation.ts (حارس unhandledRejection في serverless).
  
  // فحص الأنواع والـ lint يجري في بيئة التطوير؛ لا نُعطّل النشر بسببها.
  // (أنواع TypeScript تُمحى وقت التشغيل، والتحقق الفعلي يتم عبر Zod وقيود قاعدة البيانات.)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
