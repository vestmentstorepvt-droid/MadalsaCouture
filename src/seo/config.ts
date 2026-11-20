// Site-wide SEO settings. The production address comes from NEXT_PUBLIC_SITE_URL so preview
// copies (*.vercel.app, the Render API host, localhost) never compete with the real site.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://madalsacouture.com").replace(/\/+$/, "");
export const SITE_NAME = "Madalsa Couture";
export const SITE_HOST = new URL(SITE_URL).host;

/** Default social preview image (the one the original index.html used). */
export const DEFAULT_OG_IMAGE =
  "https://res.cloudinary.com/crond4vx/image/upload/w_1200,h_630,c_fill,f_auto,q_auto/v1786913609/Madalsa/gener/new-product/qgzzukhoavzmc6vf4p9p.webp";

/** Search engines may index only the production host (with or without "www."). */
export function isProductionHost(host: string | null | undefined): boolean {
  const h = String(host || "").toLowerCase().split(":")[0];
  return h === SITE_HOST || h === `www.${SITE_HOST}` || `www.${h}` === SITE_HOST;
}

export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Storefront policy pages: route -> CMS static-page slug. */
export const POLICY_ROUTES: Record<string, { slug: string; title: string }> = {
  terms: { slug: "terms-and-conditions", title: "Terms & Conditions" },
  "privacy-policy": { slug: "privacy-policy", title: "Privacy Policy" },
  "refund-policy": { slug: "refund-policy", title: "Refund Policy" },
  "shipping-policy": { slug: "shipping-policy", title: "Shipping Policy" },
};

/** Account, checkout and admin screens: usable, but never indexed. */
export const PRIVATE_ROUTES: Record<string, string> = {
  login: "Sign in",
  signup: "Create an account",
  "forgot-password": "Forgot password",
  "reset-password": "Reset password",
  "verify-email-change": "Verify email change",
  unauthorized: "Access denied",
  cart: "Your bag",
  checkout: "Checkout",
  "checkout-success": "Order placed",
  profile: "My profile",
  "my-orders": "My orders",
  wishlist: "Wishlist",
  addresses: "Saved addresses",
};
export const PRIVATE_PREFIXES: Record<string, string> = {
  "order-success": "Order placed",
  user: "My account",
  admin: "Admin",
};
