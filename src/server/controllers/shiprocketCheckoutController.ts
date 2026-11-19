// @ts-nocheck — ported from the Express backend (controllers/shiprocketCheckoutController.js); logic unchanged.
import * as __imp0 from "node:crypto";
import __imp1 from "axios";
import __imp2 from "@/server/models/variantModel";

const crypto = __imp0;
const axios = __imp1;
const Variant = __imp2;

/**
 * Helper to get required environment variable
 */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Generate redirect URL for Shiprocket
 */
function redirectUrlFor(sellerDomain) {
  return `${sellerDomain}/checkout-success`;
}

/**
 * Generate Shiprocket Checkout Token
 *
 * Endpoint: POST /api/checkout/token
 * Body: { cartItems: [{ productId, variantId, quantity }, ...] }
 *
 * Fetches actual variant data from database and uses user-selected quantities
 */
async function generateCheckoutToken(req, res) {
  try {
    const apiKey = requiredEnvironment('SHIPROCKET_API_KEY');
    const secretKey = requiredEnvironment('SHIPROCKET_SECRET_KEY');
    const sellerDomain = requiredEnvironment('SELLER_DOMAIN');

    // Get cart items from frontend request
    const { cartItems } = req.body;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty or invalid'
      });
    }

    // Build cart items by fetching actual variant data from database
    const items = [];
    for (const cartItem of cartItems) {
      const { variantId, quantity } = cartItem;

      if (!variantId || !quantity) {
        return res.status(400).json({
          success: false,
          message: 'Each cart item must have variantId and quantity'
        });
      }

      // Fetch variant from database to get the variant ID and validate it exists
      const variant = await Variant.findById(variantId);
      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Variant not found: ${variantId}`
        });
      }

      // Add item with actual variant ID from database and user-selected quantity
      items.push({
        // The same numeric id the catalog feed gives Shiprocket (catalogController: last 8 hex
        // digits of the ObjectId). Sending the full ObjectId makes Shiprocket fail with HTTP 500.
        variant_id: parseInt(variant._id.toString().slice(-8), 16),
        quantity: Math.max(1, parseInt(quantity) || 1) // Use user quantity, min 1
      });
    }

    const payload = {
      cart_data: {
        items: items  // Use actual variant IDs and quantities
      },
      redirect_url: redirectUrlFor(sellerDomain),
      timestamp: new Date().toISOString()
    };
    const requestBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(requestBody, 'utf8')
      .digest('base64');

    const shiprocketResponse = await axios.post(
      'https://checkout-api.shiprocket.com/api/v1/access-token/checkout',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
          'X-Api-HMAC-SHA256': signature
        },
        timeout: 15000
      }
    );

    const token = shiprocketResponse.data?.result?.token;

    if (!token) {
      return res.status(502).json({
        success: false,
        message: 'Shiprocket did not return a checkout token.'
      });
    }

    return res.json({ success: true, token });
  } catch (error) {
    const upstreamStatus = error.response?.status;
    const upstreamData = error.response?.data;

    return res.status(502).json({
      success: false,
      message: upstreamStatus
        ? `Shiprocket rejected the token request (HTTP ${upstreamStatus})`
        : error.message
    });
  }
}

const __exports: any = { generateCheckoutToken };

export default __exports;
