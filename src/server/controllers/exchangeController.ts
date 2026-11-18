// @ts-nocheck — ported from the Express backend (controllers/exchangeController.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/services/exchangeService";
import __imp2 from "@/server/repositories/exchangeRepository";
import __imp3 from "@/server/utils/response";
import __imp4 from "@/server/validators/exchangeValidator";

const mongoose = __imp0;
const exchangeService = __imp1;
const exchangeRepository = __imp2;
const { sendSuccess, sendError } = __imp3;
const {
  approveExchangeSchema,
  rejectExchangeSchema,
  qcResultSchema
} = __imp4;

class ExchangeController {
  /**
   * GET /api/v1/admin/exchanges[?orderId=<id>]
   * List all exchanges, or filter by orderId.
   */
  async listExchanges(req, res, next) {
    try {
      let exchanges;

      if (req.query.orderId) {
        exchanges = await exchangeRepository.findByOrderId(req.query.orderId);
      } else {
        // Lazy model access to avoid circular-dependency / load-order issues
        const Exchange = mongoose.models.Exchange || mongoose.model('Exchange');
        exchanges = await Exchange.find({})
          .populate('orderId', 'orderNumber')
          .populate('requestedBy', 'name email')
          .sort({ createdAt: -1 })
          .lean();
      }

      return sendSuccess(res, { exchanges });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/exchanges/:id
   * Fetch a single exchange by ObjectId.
   */
  async getExchange(req, res, next) {
    try {
      const exchange = await exchangeRepository.findById(req.params.id);

      if (!exchange) {
        return sendError(res, 'NOT_FOUND', 'Exchange not found.', 404);
      }

      return sendSuccess(res, { exchange });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/exchanges/:id/approve
   * Approve a pending exchange request.
   * Body: { note?: string }
   */
  async approveExchange(req, res, next) {
    try {
      const result = approveExchangeSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({ field: e.path.join('.'), message: e.message }));
        return sendError(res, 'VALIDATION_ERROR', 'Validation failed.', 400, details);
      }

      const exchange = await exchangeService.approveExchange(req.params.id, result.data, req.user);
      return sendSuccess(res, { exchange });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/exchanges/:id/reject
   * Reject a pending exchange request.
   * Body: { note?: string }
   */
  async rejectExchange(req, res, next) {
    try {
      const result = rejectExchangeSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({ field: e.path.join('.'), message: e.message }));
        return sendError(res, 'VALIDATION_ERROR', 'Validation failed.', 400, details);
      }

      const exchange = await exchangeService.rejectExchange(req.params.id, result.data.note, req.user);
      return sendSuccess(res, { exchange });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/exchanges/:id/qc
   * Record the QC inspection result for a returned item.
   * Body: { passed: boolean, note?: string }
   */
  async recordQcResult(req, res, next) {
    try {
      const result = qcResultSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({ field: e.path.join('.'), message: e.message }));
        return sendError(res, 'VALIDATION_ERROR', 'Validation failed.', 400, details);
      }

      const exchange = await exchangeService.recordQcResult(
        req.params.id,
        result.data.passed,
        result.data.note,
        req.user
      );
      return sendSuccess(res, { exchange });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new ExchangeController();

export default __exports;
