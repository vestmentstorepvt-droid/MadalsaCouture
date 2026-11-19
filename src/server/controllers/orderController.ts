// @ts-nocheck — ported from the Express backend (controllers/orderController.js); logic unchanged.
import __imp0 from "@/server/services/orderService";
import __imp1 from "@/server/repositories/orderRepository";
import __imp2 from "@/server/utils/response";
import __imp3 from "@/server/validators/orderValidator";
import __imp4 from "@/server/services/metaConversionsService";
import __imp5 from "@/server/config/logger";
import __imp6 from "@/server/models/exchangeModel";

const orderService = __imp0;
const orderRepository = __imp1;
const { sendSuccess, sendError } = __imp2;
const { createOrderSchema, updateOrderStatusSchema } = __imp3;
const metaCapi = __imp4;
const logger = __imp5;

/**
 * Parse pagination options from query params.
 *
 * @param {object} query - Express req.query
 * @returns {{ page: number, limit: number }}
 */
function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

class OrderController {
  // ─── Customer endpoints ──────────────────────────────────────────────────

  /**
   * POST /api/v1/orders
   * Place a new order (authenticated or guest).
   */
  async createOrder(req, res, next) {
    try {
      const result = createOrderSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({ field: e.path.join('.'), message: e.message }));
        logger.warn(`createOrder validation failed: ${JSON.stringify(details)} Body: ${JSON.stringify(req.body)}`);
        return sendError(res, 'VALIDATION_ERROR', 'Validation failed.', 400, details);
      }

      const order = await orderService.createOrder(result.data, req.user || null);

      // ── Meta CAPI: COD Purchase event ──────────────────────────────────
      // For Cash on Delivery orders, stock is deducted at order creation —
      // this is the reliable, server-verified conversion moment. The
      // eventId uses a deterministic format (`cod_{orderId}`) so the
      // frontend can fire the matching browser-side fbq('track','Purchase')
      // with the same eventID for deduplication.
      //
      // Why here and not in markCodPaid?
      //  - markCodPaid is an admin action that may happen days/weeks later
      //    when the physical cash is collected. For Meta ad attribution the
      //    conversion should be attributed to the moment the customer placed
      //    the order, not when the delivery person marked it paid.
      //  - The customer cannot forge this: createOrder runs server-side with
      //    stock reservation, address validation, coupon validation, etc.
      //
      // Fire-and-forget — never blocks the response.
      if (result.data.paymentMethod === 'cod' && order?._id) {
        const u = req.user || {};
        metaCapi.trackPurchase(
          req,
          {
            orderId:  order._id,
            value:    order.total,
            currency: 'INR',
            items:    order.items || [],
            user: {
              email:     u.email,
              phone:     u.phone,
              firstName: u.firstName,
              lastName:  u.lastName,
            },
          },
          `cod_${order._id}`,
        ).catch((err) => {
          logger.error(`[MetaCAPI] COD Purchase event failed for order ${order._id}: ${err.message}`);
        });
      }
      // ──────────────────────────────────────────────────────────────────

      return sendSuccess(res, { order }, 201);
    } catch (error) {
      next(error);
    }
  }


  /**
   * GET /api/v1/orders
   * List the authenticated user's orders with pagination.
   */
  async listMyOrders(req, res, next) {
    try {
      const { page, limit } = parsePagination(req.query);
      const result = await orderRepository.findByUser(req.user.id, { page, limit });
      return sendSuccess(res, { orders: result.data }, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/orders/:id
   * Fetch a single order belonging to the authenticated user.
   */
  async getMyOrder(req, res, next) {
    try {
      const order = await orderRepository.findById(req.params.id, { populate: true });

      if (!order) {
        return sendError(res, 'NOT_FOUND', 'Order not found.', 404);
      }

      // Ownership check. A guest order (userId === null) has no owner to
      // match against, so it must NOT be treated as accessible-by-default —
      // only an admin can look one up here; otherwise any authenticated
      // customer could view any guest order just by knowing its id.
      const isOwner = order.userId && order.userId.toString() === req.user.id.toString();
      const isAdmin = req.user.role === 'ADMIN';
      if (!isOwner && !isAdmin) {
        return sendError(res, 'FORBIDDEN', 'You do not have access to this order.', 403);
      }

      return sendSuccess(res, { order });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/orders/:id/cancel
   * Body: { reason, note? } — reason is one of CANCEL_REASONS (src/shared/cancelReasons.ts).
   * Cancel an order on behalf of the authenticated user.
   */
  async cancelMyOrder(req, res, next) {
    try {
      const order = await orderService.cancelOrder(req.params.id, req.user.id, {
        reason: req.body?.reason,
        note: req.body?.note,
      });
      return sendSuccess(res, { order });
    } catch (error) {
      next(error);
    }
  }

  // ─── Admin endpoints ─────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/orders
   * List all orders with optional filters and pagination.
   *
   * Query params: status, userId, orderNumber, dateFrom, dateTo, paymentMethod,
   *               page, limit
   */
  async listOrders(req, res, next) {
    try {
      const { page, limit } = parsePagination(req.query);

      const { status, userId, orderNumber, dateFrom, dateTo, paymentMethod } = req.query;

      const filters = {};
      if (status)        filters.status        = status;
      if (userId)        filters.userId        = userId;
      if (orderNumber)   filters.orderNumber   = orderNumber;
      if (dateFrom)      filters.dateFrom      = dateFrom;
      if (dateTo)        filters.dateTo        = dateTo;
      if (paymentMethod) filters.paymentMethod = paymentMethod;

      const result = await orderRepository.findAll(filters, page, limit);
      return sendSuccess(res, { orders: result.data }, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/orders/:id
   * Fetch any order by ObjectId (admin view, fully populated).
   */
  async getOrder(req, res, next) {
    try {
      const order = await orderRepository.findById(req.params.id, { populate: true });

      if (!order) {
        return sendError(res, 'NOT_FOUND', 'Order not found.', 404);
      }

      const Exchange = __imp6;
      const exchange = await Exchange.findOne({ orderId: req.params.id }).sort({ createdAt: -1 }).lean();


      return sendSuccess(res, { order, exchange: exchange || null });
    } catch (error) {
      next(error);
    }
  }


  /**
   * PATCH /api/v1/admin/orders/:id/status
   * Transition an order to a new status (admin only).
   * Body: { status: string, note?: string }
   */
  async updateOrderStatus(req, res, next) {
    try {
      const result = updateOrderStatusSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({ field: e.path.join('.'), message: e.message }));
        return sendError(res, 'VALIDATION_ERROR', 'Validation failed.', 400, details);
      }

      const { status, note } = result.data;
      const order = await orderService.transitionStatus(
        req.params.id,
        status,
        req.user,
        note
      );
      return sendSuccess(res, { order });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new OrderController();

export default __exports;
