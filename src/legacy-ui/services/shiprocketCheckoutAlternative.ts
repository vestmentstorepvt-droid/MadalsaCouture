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

/**
 * Redirect the browser to Shiprocket Checkout.
 * The token authenticates the session; Shiprocket sends the buyer back to /checkout-success afterwards.
 */
export function openShiprocketCheckoutRedirect(token: string) {
  if (!token || token.trim() === '') {
    throw new Error('Invalid checkout token received');
  }

  window.location.href = `https://checkout.shiprocket.in/checkout?token=${encodeURIComponent(token)}`;
}
