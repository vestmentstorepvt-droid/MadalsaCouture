// @ts-nocheck — ported from the Express backend (controllers/variantController.js); logic unchanged.
import __imp0 from "@/server/services/variantService";
import __imp1 from "@/server/services/productService";
import __imp2 from "@/server/utils/response";

const variantService = __imp0;
const productService = __imp1;
const { sendSuccess } = __imp2;

class VariantController {
  // ── Admin endpoints ────────────────────────────────────────────────────────

  /** POST /api/v1/admin/products/:productId/variants */
  async createVariant(req, res, next) {
    try {
      const variant = await variantService.createVariant(
        req.params.productId,
        req.body,
        req.user.id
      );
      
      return sendSuccess(res, { variant }, 201);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/admin/variants/:variantId */
  async getVariant(req, res, next) {
    try {
      const variant = await variantService.getVariantById(req.params.variantId);
      return sendSuccess(res, { variant });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/admin/products/:productId/variants */
  async listVariants(req, res, next) {
    try {
      const variants = await variantService.listVariantsByProduct(req.params.productId);
      return sendSuccess(res, { variants });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/v1/admin/variants/:variantId */
  async updateVariant(req, res, next) {
    try {
      const variant = await variantService.updateVariant(
        req.params.variantId,
        req.body,
        req.user.id
      );
      
      return sendSuccess(res, { variant });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/v1/admin/variants/:variantId */
  async deleteVariant(req, res, next) {
    try {
      const variant = await variantService.softDeleteVariant(
        req.params.variantId,
        req.user.id
      );
      
      return sendSuccess(res, { variant });
    } catch (error) {
      next(error);
    }
  }

  // ── Public endpoint ────────────────────────────────────────────────────────

  /**
   * GET /api/v1/products/:productId/variants
   * Returns only storefront-safe variant fields.
   * No auth required.
   */
  async listPublicVariants(req, res, next) {
    try {
      const variants = await productService.listPublicVariants(req.params.productId);
      return sendSuccess(res, { variants });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new VariantController();

export default __exports;
