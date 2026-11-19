// @ts-nocheck — ported from the Express backend (controllers/cartController.js); logic unchanged.
import __imp0 from "@/server/services/cartService";
import __imp1 from "@/server/utils/response";
import __imp2 from "@/server/services/metaConversionsService";
import __imp3 from "@/server/config/logger";

const cartService = __imp0;
const { sendSuccess } = __imp1;
const metaCapi = __imp2;
const logger = __imp3;

class CartController {
  /**
   * GET /api/v1/cart
   * Get user's cart
   */
  async getCart(req, res, next) {
    try {
      const cart = await cartService.getCart(req.user.id);
      return sendSuccess(res, { cart }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/cart/items
   * Add item to user's cart
   */
  async addToCart(req, res, next) {
    try {
      const { productId, variantId, quantity, selectedSize, selectedColor } = req.body;
      const cart = await cartService.addToCart(req.user.id, {
        productId,
        variantId,
        quantity,
        selectedSize,
        selectedColor,
      });

      // ── Meta CAPI: AddToCart event ──────────────────────────────────────
      // Fire-and-forget — never blocks the response.
      // The eventId uses a deterministic format so the frontend browser pixel
      // can fire the matching fbq('track','AddToCart') with the same eventID.
      if (productId) {
        const u = req.user || {};
        const addedItem = cart?.items?.find(
          (item) =>
            item.productId?._id?.toString() === productId &&
            (!variantId || item.variantId?._id?.toString() === variantId) &&
            (!selectedSize || item.size === selectedSize)
        );
        metaCapi.trackAddToCart(
          req,
          {
            productId,
            productName: addedItem?.name || addedItem?.productName || '',
            price: addedItem?.price ?? addedItem?.unitPrice ?? 0,
            currency: 'INR',
            user: {
              email: u.email,
              phone: u.phone,
              firstName: u.firstName,
              lastName: u.lastName,
            },
          },
          `atc_${productId}_${req.user.id}`,
        ).catch((err) => {
          logger.error(`[MetaCAPI] AddToCart event failed for product ${productId}: ${err.message}`);
        });
      }
      // ──────────────────────────────────────────────────────────────────

      return sendSuccess(res, { cart }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/cart/items/:itemId
   * Update item quantity in cart
   */
  async updateCartItem(req, res, next) {
    try {
      const { itemId } = req.params;
      const { quantity } = req.body;
      const cart = await cartService.updateCartItem(req.user.id, itemId, quantity);
      return sendSuccess(res, { cart }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/cart/items/:itemId
   * Remove item from cart
   */
  async removeCartItem(req, res, next) {
    try {
      const { itemId } = req.params;
      const cart = await cartService.removeCartItem(req.user.id, itemId);
      return sendSuccess(res, { cart }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/cart
   * Clear user's cart
   */
  async clearCart(req, res, next) {
    try {
      const cart = await cartService.clearCart(req.user.id);
      return sendSuccess(res, { cart }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/cart/remove-ordered
   * Body: { items: [{ variantId, quantity }] } — the sizes just ordered. Removes them from the
   * cart (or lowers the quantity) and leaves everything else.
   */
  async removeOrderedItems(req, res, next) {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
      const cart = await cartService.removeOrderedItems(req.user.id, items);
      return sendSuccess(res, { cart }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/cart/sync
   * Bulk sync local guest cart items to server cart
   */
  async syncCart(req, res, next) {
    try {
      const { items } = req.body;
      const cart = await cartService.syncCart(req.user.id, items || []);
      return sendSuccess(res, { cart }, 200);
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new CartController();

export default __exports;
