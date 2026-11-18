import type { NextConfig } from "next";

// Same-origin API, so the copied website keeps calling "/api/v1/...".
// LEGACY_API_ORIGIN (development only) forwards any API route the new app
// doesn't implement to the old Express backend — handy while comparing.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/",
  },
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
