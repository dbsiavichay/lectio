import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Nothing is loaded from third parties: fonts are self-hosted by next/font and
// there is no analytics. Scripts keep 'unsafe-inline' because Cache Components
// prerenders a static shell whose inline RSC payload can't carry a per-request
// nonce; React escapes every user-written value and book Markdown is rendered
// without raw HTML, which is where the injection risk would come from.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // A self-contained server (`.next/standalone/server.js`) that the Docker
  // runtime stage copies on its own, with only the traced node_modules.
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  // The dev badge would cover the bottom tab bar.
  devIndicators: { position: "top-right" },
  cacheComponents: true,
  partialPrefetching: true,
  // Native addons are required at runtime, never bundled.
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2"],
  experimental: {
    // A book package (notebook, answer guide, reviews) is about 1 MB of Markdown.
    serverActions: { bodySizeLimit: "8mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
