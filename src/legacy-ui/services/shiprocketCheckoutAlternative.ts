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

  const response = await fetch(`${API_BASE_URL}/api/v1/checkout/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

  return data.token;
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
