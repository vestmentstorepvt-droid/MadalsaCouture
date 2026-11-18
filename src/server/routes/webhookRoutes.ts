// @ts-nocheck — ported from the Express backend (routes/webhookRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/webhookController";
import __imp2 from "@/server/middleware/webhookVerification";

const express = __imp0;
const WebhookController = __imp1;
const verifyWebhookSignature = __imp2;
const { Router } = express;

const router = Router();

/**
 * Webhook Routes for Shiprocket
 *
 * Raw body is captured globally via express.json({ verify }) in security.js
 * so req.rawBody is available here for HMAC verification.
 *
 * Returns:
 * - 200: OK - Webhook processed successfully
 * - 400: Bad Request - Invalid payload
 * - 511: Unauthorized - Invalid API key or HMAC signature
 * - 500: Server Error - Internal processing error
 */

// Health check (no auth required)
router.get('/health', WebhookController.healthCheck);

// Product webhook: POST /wh/v1/custom/product
router.post('/custom/product', verifyWebhookSignature, WebhookController.handleProductWebhook);

// Collection webhook: POST /wh/v1/custom/collection
router.post('/custom/collection', verifyWebhookSignature, WebhookController.handleCollectionWebhook);

const __exports: any = router;

export default __exports;
