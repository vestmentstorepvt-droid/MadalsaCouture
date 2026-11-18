// @ts-nocheck — ported from the Express backend (controllers/inventoryController.js); logic unchanged.
import __imp0 from "@/server/services/inventoryService";
import __imp1 from "@/server/utils/response";

const inventoryService = __imp0;
const { sendSuccess } = __imp1;


/**
 * Default low-stock threshold — can be overridden via env LOW_STOCK_THRESHOLD.
 */
const DEFAULT_LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD, 10) || 5;

class InventoryController {
  /**
   * PATCH /api/v1/admin/inventory/:variantId/adjust
   *
   * Atomically adjusts the stock for a variant and writes an audit log entry.
   * Responds with the updated variant document.
   */
  async adjustStock(req, res, next) {
    try {
      const variant = await inventoryService.adjustStock(
        req.params.variantId,
        req.body.delta,
        req.body.reasonCode,
        req.body.note,
        req.user
      );
      
      return sendSuccess(res, { variant });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/inventory/low-stock
   *
   * Returns all variants whose available stock is at or below the threshold.
   * Threshold is taken from the query param `threshold`; falls back to the
   * env-configured default (LOW_STOCK_THRESHOLD) or 5.
   */
  async getInventory(req, res, next) {
    try {
      const threshold =
        req.query.threshold !== undefined
          ? parseInt(req.query.threshold, 10)
          : DEFAULT_LOW_STOCK_THRESHOLD;

      const variants = await inventoryService.getLowStockVariants(threshold);
      return sendSuccess(res, { variants });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/inventory/:variantId/log
   *
   * Returns a paginated inventory audit log for the specified variant.
   */
  async getInventoryLog(req, res, next) {
    try {
      const result = await inventoryService.getInventoryLog(
        req.params.variantId,
        { page: req.query.page, limit: req.query.limit }
      );
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new InventoryController();

export default __exports;
