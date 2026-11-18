// @ts-nocheck — ported from the Express backend (services/exchangeService.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/repositories/exchangeRepository";
import __imp2 from "@/server/repositories/orderRepository";
import __imp3 from "@/server/services/notificationService";
import __imp4 from "@/server/constants/exchangeStates";
import __imp5 from "@/server/constants/messages";
import __imp6 from "@/server/config/logger";
import __imp7 from "@/server/models/adminNotificationModel";
import __imp8 from "@/server/services/orderService";
import __imp9 from "@/server/models/userModel";

const mongoose = __imp0;

const exchangeRepository = __imp1;
const orderRepository = __imp2;
const notificationService = __imp3;
const { isValidExchangeTransition } = __imp4;
const { ERROR } = __imp5;
const logger = __imp6;
const AdminNotification = __imp7;

/**
 * Build a standardised service error.
 *
 * @param {string} message    - Human-readable message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} [code]     - SNAKE_CASE error code sent in the JSON response.
 * @returns {Error}
 */
function createError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code: code || 'REQUEST_ERROR' });
}

class ExchangeService {
  /**
   * Submit an exchange request for a delivered order item.
   *
   * Steps:
   *  1. Fetch order (with items populated). 404 if not found.
   *  2. Verify order is in 'Delivered' status. 422 if not.
   *  3. Find the matching order item by itemId. 404 if not found.
   *  4. Resolve exchange window days from product override or env var.
   *  5. Determine delivery date from statusHistory or order.updatedAt.
   *  6. Check if the exchange window has expired. 422 if expired.
   *  7. Create exchange document.
   *  8. Transition order status to 'ExchangeRequested'.
   *  9. Return the exchange document.
   *
   * @param {string|ObjectId} orderId            - Order ObjectId.
   * @param {string|ObjectId} itemId             - OrderItem ObjectId.
   * @param {string|ObjectId} userId             - Requesting user ObjectId.
   * @param {string}          reason             - Customer-provided exchange reason.
   * @param {string|ObjectId} [requestedVariantId] - Optional replacement variant.
   * @returns {Promise<Document>} Created Exchange document.
   */
  async requestExchange(orderId, itemId, userId, reason, requestedVariantId) {
    // Lazy import to avoid circular dependency
    const orderService = __imp8;

    // ── 1. Fetch order ─────────────────────────────────────────────────────
    const order = await orderRepository.findById(orderId, { populate: true });
    if (!order) {
      throw createError(ERROR.NOT_FOUND, 404, 'ORDER_NOT_FOUND');
    }

    // ── 2. Verify order status is Delivered ────────────────────────────────
    if (order.status !== 'Delivered') {
      throw createError(
        ERROR.EXCHANGE_ONLY_FOR_DELIVERED,
        422,
        'EXCHANGE_ONLY_FOR_DELIVERED'
      );
    }

    // ── 3. Find the order item by itemId ───────────────────────────────────
    const item = (order.items || []).find(
      i => i._id.toString() === itemId.toString()
    );
    if (!item) {
      throw createError(ERROR.NOT_FOUND, 404, 'ORDER_ITEM_NOT_FOUND');
    }

    // ── 4. Resolve exchange window days ────────────────────────────────────
    const Product = mongoose.models.Product || mongoose.model('Product');
    const product = await Product.findById(item.productId).lean();
    // Use per-product override (exchangeWindowDays) or fall back to env var default
    const envWindowDays = parseInt(process.env.DEFAULT_EXCHANGE_WINDOW_DAYS, 10) || 7;
    const windowDays = (product != null && product.exchangeWindowDays != null)
      ? product.exchangeWindowDays
      : envWindowDays;

    // ── 5. Find delivery date from statusHistory ───────────────────────────
    const deliveredEntry = (order.statusHistory || []).find(
      entry => entry.status === 'Delivered'
    );
    const deliveryTimestamp = deliveredEntry
      ? deliveredEntry.timestamp
      : order.updatedAt;

    // ── 6. Check exchange window ───────────────────────────────────────────
    const deliveryDate = new Date(deliveryTimestamp);
    const windowExpiry = new Date(
      deliveryDate.getTime() + windowDays * 24 * 60 * 60 * 1000
    );
    if (new Date() > windowExpiry) {
      throw createError(
        ERROR.EXCHANGE_WINDOW_EXPIRED,
        422,
        'EXCHANGE_WINDOW_EXPIRED'
      );
    }

    // ── 7. Create exchange document ────────────────────────────────────────
    const exchange = await exchangeRepository.create({
      orderId,
      orderItemId: itemId,
      requestedBy: userId,
      reason,
      requestedVariantId: requestedVariantId || null,
      status: 'ExchangeRequested'
    });

    // ── 8. Transition order status ─────────────────────────────────────────
    await orderService.transitionStatus(
      orderId,
      'ExchangeRequested',
      { id: userId },
      `Exchange requested by customer: "${reason}"`
    );


    logger.info(
      `Exchange requested: exchange=${exchange._id}, order=${orderId}, item=${itemId}, user=${userId}`
    );

    // ── 9. Return exchange document ────────────────────────────────────────
    // Fire-and-forget exchange status notification
    this._notifyExchangeStatus(exchange, 'ExchangeRequested', null);

    // Create Admin Notification
    try {
      await AdminNotification.create({
        title: 'Exchange Requested',
        message: `An exchange has been requested for order #${order.orderNumber}.`,
        type: 'exchange_requested',
        relatedId: order._id,
      });
    } catch (err) {
      logger.error(`Failed to create admin notification for exchange on order ${order._id}: ${err.message}`);
    }

    return exchange;
  }

  /**
   * Approve a pending exchange request.
   *
   * Steps:
   *  1. Fetch exchange. 404 if not found.
   *  2. Validate transition to 'ExchangeApproved'. 409 if invalid.
   *  3. Record admin decision.
   *  4. Update exchange status to 'ExchangeApproved'.
   *  5. Transition order status.
   *  6. Schedule reverse pickup (stub/TODO).
   *  7. Return updated exchange.
   *
   * @param {string|ObjectId} exchangeId     - Exchange document ObjectId.
   * @param {Object}          adminDecision  - Decision payload ({ note }).
   * @param {Object}          actor          - { id, email } of the acting admin.
   * @returns {Promise<Object>} Updated lean Exchange document.
   */
  async approveExchange(exchangeId, adminDecision, actor) {
    // Lazy import to avoid circular dependency
    const orderService = __imp8;

    // ── 1. Fetch exchange ──────────────────────────────────────────────────
    const exchange = await exchangeRepository.findById(exchangeId);
    if (!exchange) {
      throw createError(ERROR.NOT_FOUND, 404, 'EXCHANGE_NOT_FOUND');
    }

    // ── 2. Validate transition ─────────────────────────────────────────────
    if (!isValidExchangeTransition(exchange.status, 'ExchangeApproved')) {
      throw createError(ERROR.INVALID_TRANSITION, 409, 'INVALID_TRANSITION');
    }

    // ── 3. Record admin decision ───────────────────────────────────────────
    await exchangeRepository.setAdminDecision(exchangeId, {
      decidedBy: actor.id,
      decidedAt: new Date(),
      note: adminDecision.note || null
    });

    // ── 4. Update exchange status ──────────────────────────────────────────
    const updatedExchange = await exchangeRepository.updateStatus(
      exchangeId,
      'ExchangeApproved'
    );

    // ── 5. Transition order status ─────────────────────────────────────────
    await orderService.transitionStatus(
      exchange.orderId,
      'ExchangeApproved',
      actor,
      'Exchange approved'
    );

    // ── 6. Advance order through pickup states ─────────────────────────────
    // Reverse pickup is handled manually (no shipping integration).
    // Advance the order to ExchangePickupScheduled so that recordQcResult's
    // later jump to ReplacementShipped remains valid.
    try {
      await orderService.advanceTo(
        exchange.orderId,
        'ExchangePickupScheduled',
        actor,
        'Reverse pickup scheduled'
      );
    } catch (err) {
      logger.warn(
        `Order advance to ExchangePickupScheduled failed for exchange ${exchangeId}: ${err.message}`
      );
    }

    logger.info(
      `Exchange approved: exchange=${exchangeId}, order=${exchange.orderId}, actor=${actor.id}`
    );

    // ── 7. Return updated exchange ─────────────────────────────────────────
    // Fire-and-forget exchange status notification
    this._notifyExchangeStatus(updatedExchange, 'ExchangeApproved', actor);

    return updatedExchange;
  }

  /**
   * Reject a pending exchange request.
   *
   * Steps:
   *  1. Fetch exchange. 404 if not found.
   *  2. Validate transition to 'ExchangeRejected'. 409 if invalid.
   *  3. Record admin decision.
   *  4. Update exchange status to 'ExchangeRejected'.
   *  5. Transition order status to 'ExchangeRejected'.
   *  6. Return updated exchange.
   *
   * @param {string|ObjectId} exchangeId - Exchange document ObjectId.
   * @param {string}          note       - Rejection note.
   * @param {Object}          actor      - { id, email } of the acting admin.
   * @returns {Promise<Object>} Updated lean Exchange document.
   */
  async rejectExchange(exchangeId, note, actor) {
    // Lazy import to avoid circular dependency
    const orderService = __imp8;

    // ── 1. Fetch exchange ──────────────────────────────────────────────────
    const exchange = await exchangeRepository.findById(exchangeId);
    if (!exchange) {
      throw createError(ERROR.NOT_FOUND, 404, 'EXCHANGE_NOT_FOUND');
    }

    // ── 2. Validate transition ─────────────────────────────────────────────
    if (!isValidExchangeTransition(exchange.status, 'ExchangeRejected')) {
      throw createError(ERROR.INVALID_TRANSITION, 409, 'INVALID_TRANSITION');
    }

    // ── 3. Record admin decision ───────────────────────────────────────────
    await exchangeRepository.setAdminDecision(exchangeId, {
      decidedBy: actor.id,
      decidedAt: new Date(),
      note: note || null
    });

    // ── 4. Update exchange status ──────────────────────────────────────────
    const updatedExchange = await exchangeRepository.updateStatus(
      exchangeId,
      'ExchangeRejected'
    );

    // ── 5. Transition order status ─────────────────────────────────────────
    await orderService.transitionStatus(
      exchange.orderId,
      'ExchangeRejected',
      actor,
      'Exchange rejected'
    );

    logger.info(
      `Exchange rejected: exchange=${exchangeId}, order=${exchange.orderId}, actor=${actor.id}`
    );

    // ── 6. Return updated exchange ─────────────────────────────────────────
    // Fire-and-forget exchange status notification
    this._notifyExchangeStatus(updatedExchange, 'ExchangeRejected', actor);

    return updatedExchange;
  }

  /**
   * Record the QC inspection result for a returned exchange item.
   *
   * Steps:
   *  1. Fetch exchange. 404 if not found.
   *  2. Determine target status: 'QCPassed' or 'QCFailed'.
   *  3. Validate transition. 409 if invalid.
   *  4. Record QC result.
   *  5. Update exchange status.
   *  6. If passed: transition order to 'ReplacementShipped' and update exchange
   *     status to 'ReplacementShipped' as well.
   *  7. If not passed: skip order transition — QCFailed is a terminal state for
   *     the exchange; log a warning instead.
   *  8. Return updated exchange.
   *
   * @param {string|ObjectId} exchangeId - Exchange document ObjectId.
   * @param {boolean}         passed     - Whether the item passed QC.
   * @param {string}          note       - QC inspection note.
   * @param {Object}          actor      - { id, email } of the user recording QC.
   * @returns {Promise<Object>} Updated lean Exchange document.
   */
  async recordQcResult(exchangeId, passed, note, actor) {
    // Lazy import to avoid circular dependency
    const orderService = __imp8;

    // ── 1. Fetch exchange ──────────────────────────────────────────────────
    const exchange = await exchangeRepository.findById(exchangeId);
    if (!exchange) {
      throw createError(ERROR.NOT_FOUND, 404, 'EXCHANGE_NOT_FOUND');
    }

    // ── 2. Determine target status ─────────────────────────────────────────
    const targetStatus = passed ? 'QCPassed' : 'QCFailed';

    // ── 3. Validate transition ─────────────────────────────────────────────
    if (!isValidExchangeTransition(exchange.status, targetStatus)) {
      throw createError(ERROR.INVALID_TRANSITION, 409, 'INVALID_TRANSITION');
    }

    // ── 4. Record QC result ────────────────────────────────────────────────
    await exchangeRepository.setQcResult(exchangeId, {
      passed,
      note: note || null,
      recordedBy: actor.id,
      recordedAt: new Date()
    });

    // ── 5. Update exchange status ──────────────────────────────────────────
    let updatedExchange = await exchangeRepository.updateStatus(
      exchangeId,
      targetStatus
    );

    if (passed) {
      // ── 6a. QC passed: transition order to ReplacementShipped and update
      //        exchange status to ReplacementShipped as well.
      //        Note: in production this happens after actual shipment creation,
      //        but we transition immediately as per current spec.
      //        Uses advanceTo (not transitionStatus) so this succeeds even if
      //        the order didn't already pass through ExchangePickupScheduled /
      //        ExchangeInTransit — e.g. if reverse-pickup scheduling in
      //        `approveExchange` failed and was retried out-of-band. advanceTo
      //        walks whichever intermediate hops the state machine requires.
      await orderService.advanceTo(
        exchange.orderId,
        'ReplacementShipped',
        actor,
        'QC passed — replacement shipped'
      );

      updatedExchange = await exchangeRepository.updateStatus(
        exchangeId,
        'ReplacementShipped'
      );

      logger.info(
        `QC passed for exchange ${exchangeId}; order ${exchange.orderId} → ReplacementShipped`
      );
    } else {
      // ── 6b. QC failed: terminal exchange state — no order transition defined
      //        in the order state machine for QCFailed. Log a warning.
      logger.warn(
        `QC failed for exchange ${exchangeId} (order ${exchange.orderId}). ` +
        'No automatic order status transition — manual resolution required.'
      );
    }

    // ── 7. Return updated exchange ─────────────────────────────────────────
    // Fire-and-forget exchange status notification (use final updatedExchange status)
    this._notifyExchangeStatus(updatedExchange, updatedExchange.status || targetStatus, actor);

    return updatedExchange;
  }

  /**
   * Fire-and-forget: sends an exchange_status_update notification to the
   * requesting user. Errors are silently swallowed so they never affect the
   * main request flow.
   *
   * @param {Object}          exchange  - Exchange document (must have requestedBy).
   * @param {string}          newStatus - The status that was just applied.
   * @param {Object|null}     actor     - { id, email } of the acting user (unused for now).
   */
  async _notifyExchangeStatus(exchange, newStatus, actor) {
    try {
      const User = __imp9;
      const user = await User.findById(exchange.requestedBy).select('email name').lean();
      if (user?.email) {
        notificationService.send(
          'exchange_status_update',
          user.email,
          {
            status: newStatus,
            exchangeId: exchange._id.toString()
          },
          exchange.requestedBy
        );
      }
    } catch (err) {
      logger.warn(
        `Failed to send exchange notification for exchange ${exchange._id}: ${err.message}`
      );
    }
  }
}

const __exports: any = new ExchangeService();

export default __exports;
