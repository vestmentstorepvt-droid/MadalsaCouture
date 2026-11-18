// @ts-nocheck — ported from the Express backend (controllers/wishlistController.js); logic unchanged.
import __imp0 from "@/server/services/wishlistService";
import __imp1 from "@/server/utils/response";

const wishlistService = __imp0;
const { sendSuccess } = __imp1;

class WishlistController {
  /**
   * POST /api/v1/wishlist/:productId
   * Add a product to the authenticated user's wishlist.
   */
  async addToWishlist(req, res, next) {
    try {
      const wishlist = await wishlistService.addToWishlist(req.user.id, req.params.productId);
      return sendSuccess(res, { wishlist });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/wishlist/:productId
   * Remove a product from the authenticated user's wishlist.
   */
  async removeFromWishlist(req, res, next) {
    try {
      const wishlist = await wishlistService.removeFromWishlist(req.user.id, req.params.productId);
      return sendSuccess(res, { wishlist });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/wishlist
   * Get the authenticated user's wishlist with populated product details.
   */
  async getWishlist(req, res, next) {
    try {
      const wishlist = await wishlistService.getWishlist(req.user.id);
      return sendSuccess(res, { wishlist });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new WishlistController();

export default __exports;
