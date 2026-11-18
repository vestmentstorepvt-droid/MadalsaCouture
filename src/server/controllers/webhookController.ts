// @ts-nocheck — ported from the Express backend (controllers/webhookController.js); logic unchanged.
import __imp0 from "@/server/config/logger";
import __imp1 from "@/server/services/webhookService";
import __imp2 from "@/server/utils/response";

const logger = __imp0;
const WebhookService = __imp1;
const { sendSuccess, sendError } = __imp2;

/**
 * Webhook Controller for Shiprocket integrations
 */
class WebhookController {
  /**
   * POST /wh/v1/custom/product
   * Handle product sync webhook from Shiprocket
   */
  static async handleProductWebhook(req, res) {
    try {
      const payload = req.body;

      // Validate payload
      if (!payload || typeof payload !== 'object') {
        logger.warn('Invalid product webhook payload');
        return sendError(res, 'Invalid payload format', 400);
      }

      // Process webhook
      const product = await WebhookService.handleProductWebhook(payload);

      // Log successful webhook
      logger.info('Product webhook processed', {
        shiprocketId: payload.id,
        productId: product._id,
        title: payload.title,
      });

      return sendSuccess(res, {
        message: 'Product webhook processed successfully',
        product: {
          id: product._id,
          title: product.title,
          externalId: product.externalShiprocketId,
        },
      }, 200);
    } catch (error) {
      logger.error('Product webhook error:', error);

      if (error.message.includes('required fields')) {
        return sendError(res, error.message, 400);
      }

      return sendError(res, 'Failed to process product webhook', 500);
    }
  }

  /**
   * POST /wh/v1/custom/collection
   * Handle collection sync webhook from Shiprocket
   */
  static async handleCollectionWebhook(req, res) {
    try {
      const payload = req.body;

      // Validate payload
      if (!payload || typeof payload !== 'object') {
        logger.warn('Invalid collection webhook payload');
        return sendError(res, 'Invalid payload format', 400);
      }

      // Process webhook
      const collection = await WebhookService.handleCollectionWebhook(payload);

      // Log successful webhook
      logger.info('Collection webhook processed', {
        shiprocketId: payload.id,
        collectionId: collection._id,
        title: payload.title,
      });

      return sendSuccess(res, {
        message: 'Collection webhook processed successfully',
        collection: {
          id: collection._id,
          name: collection.name,
          externalId: collection.externalShiprocketId,
        },
      }, 200);
    } catch (error) {
      logger.error('Collection webhook error:', error);

      if (error.message.includes('required fields')) {
        return sendError(res, error.message, 400);
      }

      return sendError(res, 'Failed to process collection webhook', 500);
    }
  }

  /**
   * Health check for webhook endpoint
   */
  static async healthCheck(req, res) {
    return sendSuccess(res, {
      status: 'webhook-service-ready',
      timestamp: new Date().toISOString(),
    });
  }
}

const __exports: any = WebhookController;

export default __exports;
