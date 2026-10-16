import type { NextConfig } from "next";

/** One year, the usual HSTS lifetime. Browsers ignore the header on plain http (e.g. localhost). */
const HSTS_MAX_AGE_SECONDS = 31_536_000;

/**
 * Sent on every response. The Content-Security-Policy is not here: it needs a fresh nonce per request,
 * so proxy.ts adds it.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains` },
];

/**
 * Server Actions reject calls whose `Origin` host differs from the app's own host. Behind a reverse proxy
 * that does not forward the public host, the public origin (APP_ORIGIN, read at build time) is allowed too.
 */
function serverActionOrigins(): string[] | undefined {
  const appOrigin = process.env.APP_ORIGIN?.trim();
  return appOrigin ? [new URL(appOrigin).host] : undefined;
}

const nextConfig: NextConfig = {
  // The Docker image sets NEXT_OUTPUT=standalone; local builds keep the regular output for `next start`.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  experimental: {
    serverActions: { allowedOrigins: serverActionOrigins() },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
