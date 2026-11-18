// @ts-nocheck — ported from the Express backend (middleware/webhookVerification.js); logic unchanged.
import * as __imp0 from "node:crypto";
import __imp1 from "@/server/config/logger";

const crypto = __imp0;
const logger = __imp1;

/**
 * Middleware to verify Shiprocket webhook signatures
 * Checks X-Api-Key and X-Api-HMAC-SHA256 headers against request body
 *
 * HMAC is calculated as: Base64(HMAC-SHA256(request_body, api_key))
 */
const verifyWebhookSignature = (req, res, next) => {
  try {
    // Get headers
    const apiKey = req.headers['x-api-key'];
    const providedHmac = req.headers['x-api-hmac-sha256'];

    // Validate headers exist
    if (!apiKey) {
      logger.warn('Webhook request missing X-Api-Key header');
      return res.status(511).json({
        error: 'Invalid X-Api-Key',
        message: 'X-Api-Key header is required',
      });
    }

    if (!providedHmac) {
      logger.warn('Webhook request missing X-Api-HMAC-SHA256 header');
      return res.status(511).json({
        error: 'Invalid X-Api-HMAC-SHA256',
        message: 'X-Api-HMAC-SHA256 header is required',
      });
    }

    // Validate API key against environment variable
    const expectedApiKey = process.env.SHIPROCKET_API_KEY;
    if (!expectedApiKey) {
      logger.error('SHIPROCKET_API_KEY not configured in environment');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Webhook validation not properly configured',
      });
    }

    if (apiKey !== expectedApiKey) {
      logger.warn(`Webhook request with invalid API key: ${apiKey.substring(0, 5)}...`);
      return res.status(511).json({
        error: 'Invalid X-Api-Key',
        message: 'Provided API key does not match',
      });
    }

    // Get raw body and calculate HMAC
    // req.body is already parsed JSON by express.json()
    // We need the raw string to calculate HMAC
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const calculatedHmac = crypto
      .createHmac('sha256', apiKey)
      .update(rawBody)
      .digest('base64');

    // Compare HMACs
    if (providedHmac !== calculatedHmac) {
      logger.warn('Webhook request with invalid HMAC signature');
      return res.status(511).json({
        error: 'Invalid X-Api-HMAC-SHA256',
        message: 'HMAC signature verification failed',
      });
    }

    // Signature verified, attach to request for logging
    req.webhookVerified = true;
    req.webhookApiKey = apiKey;

    next();
  } catch (error) {
    logger.error('Webhook verification error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify webhook signature',
    });
  }
};

const __exports: any = verifyWebhookSignature;

export default __exports;
