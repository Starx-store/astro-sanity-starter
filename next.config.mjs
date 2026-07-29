/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src *",
  "frame-ancestors 'none'",
  "base-uri 'self'",
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
  skipTrailingSlashRedirect: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      { source: "/api/v2/", destination: "/api/v2" },
      { source: "/api/v1/", destination: "/api/v2" },
      { source: "/api/v1", destination: "/api/v2" },
      { source: "/api/services/", destination: "/api/v2" },
      { source: "/api/services", destination: "/api/v2" },
    ];
  },
  async headers() {
    return [
      {
        source: "/((?!api).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
