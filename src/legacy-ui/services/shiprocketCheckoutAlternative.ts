/**
 * Shiprocket Checkout - redirect implementation (does not depend on the Shiprocket SDK)
 */

interface CartItem {
  variantId: string;
  quantity: number;
}

interface TokenResponse {
  success: boolean;
  token?: string;
  /** Server record of this checkout; becomes "ordered" when Shiprocket reports the order. */
  sessionId?: string;
  expiresIn?: number;
  message?: string;
}

// Same normalisation as api/baseQuery.ts (kept local so this module does not import the Redux store):
// strip trailing slashes so a base of "/" or "https://host/" can never produce "//api/..." URLs.
const API_BASE_URL = String(process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');

/**
 * Generate checkout token from backend
 * Sends actual cart items with variant IDs and quantities from user selection
 */
export async function generateCheckoutToken(cartItems: CartItem[]): Promise<string> {
  if (!cartItems || cartItems.length === 0) {
    throw new Error('Cart is empty');
  }

  // Signed-in shoppers send their token so the order can be linked to their account.
  let authHeader: Record<string, string> = {};
  try {
    const accessToken = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (accessToken) authHeader = { Authorization: `Bearer ${accessToken}` };
  } catch { /* storage blocked: checkout as a guest */ }

  const response = await fetch(`${API_BASE_URL}/api/v1/checkout/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
    body: JSON.stringify({ cartItems })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to generate checkout token (${response.status})`);
  }

  const data: TokenResponse = await response.json();

  if (!data.success || !data.token) {
    throw new Error(data.message || 'No token received from server');
  }

  lastSessionId = data.sessionId ?? null;
  return data.token;
}

/** What was in the bag when checkout opened, so the success page removes only those items. */
export interface CheckedOutItem {
  productId: string;
  variantId?: string;
  size?: string;
  color?: string;
  quantity: number;
}

const CHECKOUT_ITEMS_KEY = 'checkout_items';
let lastSessionId: string | null = null;
const CHECKOUT_ITEMS_MAX_AGE = 24 * 60 * 60 * 1000;

export function rememberCheckoutItems(items: CheckedOutItem[]) {
  try {
    localStorage.setItem(CHECKOUT_ITEMS_KEY, JSON.stringify({ at: Date.now(), items, sessionId: lastSessionId }));
  } catch {
    // Storage blocked: the success page then leaves the bag as it is.
  }
}

/** The items remembered at checkout (once; the record is removed). Empty if none or too old. */
export function takeCheckoutItems(): CheckedOutItem[] {
  try {
    const raw = localStorage.getItem(CHECKOUT_ITEMS_KEY);
    localStorage.removeItem(CHECKOUT_ITEMS_KEY);
    if (!raw) return [];
    const { at, items } = JSON.parse(raw);
    return Date.now() - at < CHECKOUT_ITEMS_MAX_AGE && Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/** The open checkout record without consuming it, or null if none or too old. */
export function peekPendingCheckout(): { at: number; items: CheckedOutItem[]; sessionId: string | null } | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_ITEMS_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec || !Array.isArray(rec.items) || Date.now() - rec.at >= CHECKOUT_ITEMS_MAX_AGE) return null;
    return { at: rec.at, items: rec.items, sessionId: rec.sessionId ?? null };
  } catch {
    return null;
  }
}

/** True once Shiprocket's order for this checkout has reached our server. */
export async function isCheckoutOrdered(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/checkout/session/${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === 'ordered';
  } catch {
    return false;
  }
}

// Shiprocket Checkout for custom sites: their script opens the checkout as a window over our page.
// (Sending the browser to checkout.shiprocket.in/checkout?token=… only lands on the Fastrr home page.)
const CHECKOUT_SCRIPT = 'https://checkout-ui.shiprocket.com/assets/js/channels/shopify.js';
const CHECKOUT_STYLES = 'https://checkout-ui.shiprocket.com/assets/styles/shopify.css';

declare global {
  interface Window {
    HeadlessCheckout?: {
      addToCart: (event: Event | null, token: string, options?: { fallbackUrl?: string }) => void;
    };
  }
}

let scriptLoading: Promise<void> | null = null;

/** Load Shiprocket's checkout script and styles once, on first use. */
function loadShiprocketCheckout(): Promise<void> {
  if (window.HeadlessCheckout) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<void>((resolve, reject) => {
    if (!document.querySelector(`link[href="${CHECKOUT_STYLES}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CHECKOUT_STYLES;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => (window.HeadlessCheckout ? resolve() : reject(new Error('Shiprocket checkout did not start. Please try again.')));
    script.onerror = () => {
      scriptLoading = null; // allow a retry
      reject(new Error('Could not load Shiprocket checkout. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

/**
 * Open Shiprocket Checkout over the current page.
 * The token authenticates the session; Shiprocket sends the buyer to /checkout-success after paying.
 * If the checkout can't open, Shiprocket falls back to `fallbackUrl` (this page).
 */
export async function openShiprocketCheckout(token: string) {
  if (!token || token.trim() === '') {
    throw new Error('Invalid checkout token received');
  }
  await loadShiprocketCheckout();
  setScrollbarWidth();
  window.HeadlessCheckout!.addToCart(null, token, { fallbackUrl: window.location.href });
}

/**
 * Width of a classic scrollbar on this device (0 where scrollbars overlay, e.g. phones and macOS).
 * The checkout panel styles (tailwind.css, #headless-container) use it to hide the scrollbars that
 * Shiprocket's page inside the frame always shows.
 */
function setScrollbarWidth() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
  document.body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  // The bar inside the frame can render a few px wider (browser zoom), so allow a little extra.
  document.documentElement.style.setProperty('--sr-scrollbar', `${width ? width + 3 : 0}px`);
}
