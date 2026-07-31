/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const pageCsp = [
  "default-src 'self' https: data:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data: https:",
  "connect-src *",
  "frame-ancestors 'self'",
  "base-uri 'self'",
].join("; ");

const apiCsp = [
  "default-src 'self' https: data:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data: https:",
  "connect-src *",
  "frame-ancestors *",
  "base-uri 'self'",
].join("; ");

const hstsHeader = isProd
  ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
  : [];

const commonHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...hstsHeader,
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
        // API routes: CORS open for SMM panels
        source: "/api/:path*",
        headers: [
          ...commonHeaders,
          { key: "Content-Security-Policy", value: apiCsp },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS, PUT, DELETE, PATCH" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With" },
        ],
      },
      {
        // Pages: strict clickjacking protection
        source: "/:path*",
        headers: [
          ...commonHeaders,
          { key: "Content-Security-Policy", value: pageCsp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;

