import type { NextConfig } from "next";

// Same-origin API, so the copied website keeps calling "/api/v1/...".
// LEGACY_API_ORIGIN (development only) forwards any API route the new app
// doesn't implement to the old Express backend — handy while comparing.

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy for the website pages.
// script-src is an allow-list: a script injected from any other site will not load. Shiprocket
// Checkout pulls in its own payment scripts (Razorpay, Cashfree, BillDesk, OTPless, GTM, …), so
// those hosts are listed too. connect/img/frame stay open to https: so checkout, payment and
// CMS images can never break; tightening those needs a test on a real checkout first.
const scriptHosts = [
  "https://connect.facebook.net",
  "https://accounts.google.com",
  "https://*.shiprocket.com",
  "https://*.shiprocket.in",
  "https://*.pickrr.com",
  "https://*.fastrr.com",
  "https://checkout.razorpay.com",
  "https://*.razorpay.com",
  "https://sdk.cashfree.com",
  "https://*.cashfree.com",
  "https://pay.billdesk.com",
  "https://*.billdesk.com",
  "https://otpless.com",
  "https://*.otpless.com",
  "https://*.otpless.app",
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://app.wigzo.com",
  "https://tez.google.com",
  "https://cred.club",
  "https://*.cred.club",
];

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${scriptHosts.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data: https:",
  `connect-src 'self' https: wss:${isDev ? " http://localhost:* ws://localhost:*" : ""}`,
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  // Only our own pages may put the site in a frame (stops clickjacking on login/admin).
  "frame-ancestors 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,
  // Tailwind CSS (~24 KB) goes inside the HTML instead of a separate file the page must wait for.
  // PageSpeed counted that wait as ~680 ms of render-blocking on mobile.
  experimental: { inlineCss: true },
  // Lets a second local server run alongside another (e.g. NEXT_DIST_DIR=.next-alt).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
