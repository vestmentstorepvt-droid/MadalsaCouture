// @ts-nocheck — port of middleware/security.js (limiters kept identical).
import rateLimit from "@/server/lib/rate-limit";

const isDev = process.env.NODE_ENV !== "production";

// Global fallback limiter (skipped in development to prevent 429 errors during dev/testing)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 600 / 15 min: one page view makes several API calls, and many mobile users share one IP.
  max: isDev ? 10000 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later.", details: [] } },
});

// Auth routes: 20 req / 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: { code: "RATE_LIMITED", message: "Too many authentication attempts.", details: [] } },
});

// Payment routes: 10 req / 1 min
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: { code: "RATE_LIMITED", message: "Too many payment requests.", details: [] } },
});

// Coupon validation: 30 req / 1 min
export const couponLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: { code: "RATE_LIMITED", message: "Too many coupon validation requests.", details: [] } },
});

// Public forms that send an email (contact, promo signup): 5 req / 15 min per IP
export const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later.", details: [] } },
});

const __exports: any = { globalLimiter, authLimiter, paymentLimiter, couponLimiter, formLimiter };
export default __exports;
