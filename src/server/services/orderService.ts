// @ts-nocheck — ported from the Express backend (services/orderService.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/repositories/orderRepository";
import __imp2 from "@/server/services/variantService";
import __imp3 from "@/server/services/couponService";
import __imp4 from "@/server/services/notificationService";
import __imp5 from "@/server/modules/orders/orders.stateMachine";
import __imp6 from "@/server/utils/stateMachine";
import __imp7 from "@/server/constants/messages";
import __imp8 from "@/server/config/logger";
import __imp9 from "@/server/models/adminNotificationModel";
import __imp10 from "@/server/models/orderItemModel";
import __imp11 from "@/server/repositories/exchangeRepository";
import __imp12 from "@/server/models/userModel";

const mongoose = __imp0;

const orderRepository = __imp1;
const variantService = __imp2;
const couponService = __imp3;
const notificationService = __imp4;
const { isValidTransition, TRANSITIONS } = __imp5;
const { findPath } = __imp6;
const { ERROR } = __imp7;
const logger = __imp8;
const AdminNotification = __imp9;

/**
 * Detect the specific MongoDB error thrown when a session/transaction is
 * started against a deployment that doesn't support them (a standalone
 * mongod rather than a replica set / mongos). Production deployments
 * (MongoDB Atlas, or any self-hosted replica set) always support
 * transactions; this only matters for some local single-node dev setups.
 */
function isTransactionsUnsupportedError(err) {
  return (
    err &&
    (err.code === 20 ||
      /Transaction numbers are only allowed on a replica set member or mongos/i.test(err.message || '') ||
      /Transactions are not supported/i.test(err.message || ''))
  );
}

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

/**
 * Free-shipping threshold in INR (falls back to 4999 if env var is unset or invalid).
 */
function getFreeShippingThreshold() {
  const parsed = parseFloat(process.env.FREE_SHIPPING_THRESHOLD_INR);
  return Number.isFinite(parsed) ? parsed : 4999;
}

/**
 * Fetch the Product model lazily (avoiding circular-dependency issues).
 */
function getProductModel() {
  return mongoose.models.Product || mongoose.model('Product');
}

/**
 * Fetch the Variant model lazily (avoiding circular-dependency issues at load time).
 */
function getVariantModel() {
  return mongoose.models.Variant || mongoose.model('Variant');
}

class OrderService {
  /**
   * Place a new order.
   *
   * Steps:
   *  1. Fetch live variant prices.
   *  2. Compute server-side subtotal.
   *  3. Validate coupon (if provided).
   *  4. Compute shipping charge.
   *  5. Set taxAmount = 0.
   *  6. Compute total.
   *  7. Compare against clientTotal (if provided).
   *  8. Reserve stock atomically; roll back on partial failure.
   *  9. Capture item snapshots.
   * 10. Generate atomic order number.
   * 11. Create OrderItem documents.
   * 12. Build & save Order document.
   * 13. Return the saved order.
   *
   * @param {Object} payload - Order payload from the controller.
   * @param {Object} user    - Authenticated user (id, email) or null for guest.
   * @returns {Promise<Object>} Saved Order Mongoose document.
   */
  async createOrder(payload, user) {
    const { items: payloadItems, couponCode, clientTotal, paymentMethod, guestEmail } = payload;
    let { shippingAddress } = payload;

    // Look up Address document by addressId if shippingAddress object was not directly sent
    if (!shippingAddress && payload.addressId) {
      const Address = mongoose.models.Address || mongoose.model('Address');
      const addrDoc = await Address.findById(payload.addressId).lean();
      if (addrDoc) {
        shippingAddress = {
          name: addrDoc.name || addrDoc.fullName || 'Customer',
          addressLine: addrDoc.addressLine || [addrDoc.line1, addrDoc.line2].filter(Boolean).join(', '),
          city: addrDoc.city,
          state: addrDoc.state,
          pincode: addrDoc.pincode,
          country: addrDoc.country || 'India',
          phone: addrDoc.phone,
          deliveryPhone: addrDoc.deliveryPhone || null,
        };
      }
    }

    if (!shippingAddress) {
      throw createError('A valid delivery address is required to place an order.', 400, 'ADDRESS_REQUIRED');
    }

    // ── 1. Fetch live variant documents ────────────────────────────────────
    const Variant = getVariantModel();
    const Product = getProductModel();


    // Resolve missing variantId from productId if needed
    for (const item of payloadItems) {
      if (!item.variantId && item.productId) {
        let v = await Variant.findOne({ productId: item.productId, isDeleted: false }).lean();
        if (!v) {
          const prod = await Product.findById(item.productId).lean();
          if (prod) {
            const created = await Variant.create({
              productId: prod._id,
              sku: `${prod.slug || 'PRD'}-DEFAULT`,
              price: prod.basePrice || item.price || 0,
              stockQuantity: 999
            });
            v = created.toObject();
          }
        }
        if (v) {
          item.variantId = v._id;
        }
      }
    }

    const variantIds = payloadItems.map(i => i.variantId).filter(Boolean);

    const variants = await Variant.find({
      _id: { $in: variantIds },
      isDeleted: false
    }).lean();

    // Index variants by id string for fast lookup
    const variantMap = new Map(variants.map(v => [v._id.toString(), v]));

    // Guard: all requested variants must exist
    for (const item of payloadItems) {
      if (!item.variantId || !variantMap.has(item.variantId.toString())) {
        throw createError(ERROR.NOT_FOUND, 404, 'VARIANT_NOT_FOUND');
      }
    }


    // ── 2b. Fetch products for eligibility checks + coupon scope ───────────
    const productIds = [...new Set(variants.map(v => v.productId.toString()))];
    const products = await Product.find({ _id: { $in: productIds }, isDeleted: false }).lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // ── 2. Compute subtotal server-side based on basePrice ─────────────────
    let subtotal = 0;
    for (const item of payloadItems) {
      const variant = variantMap.get(item.variantId.toString());
      const product = productMap.get(variant.productId.toString()) || {};
      const effectivePrice = Number(product.basePrice ?? variant.price ?? 0);
      subtotal += effectivePrice * item.quantity;
    }

    // ── 2c. Enforce isCODEligible ──────────────────────────────────────────
    if (paymentMethod === 'cod') {
      const codIneligible = variants.filter(v => {
        const product = productMap.get(v.productId.toString());
        return product && product.isCODEligible === false;
      });
      if (codIneligible.length > 0) {
        throw createError(
          'One or more items in your cart are not eligible for Cash on Delivery.',
          409,
          'COD_NOT_ELIGIBLE'
        );
      }
    }

    // ── 3. Coupon validation (if code provided) ────────────────────────────
    let discountAmount = 0;
    let isFreeShipping = false;
    let couponDoc = null;

    if (couponCode) {
      const enrichedCartItems = payloadItems.map(item => {
        const variant = variantMap.get(item.variantId.toString());
        const product = productMap.get(variant.productId.toString()) || {};
        const effectivePrice = Number(product.basePrice ?? variant.price ?? 0);
        return {
          productId: variant.productId,
          variantId: variant._id,
          categoryId: product.categoryId || null,
          collectionIds: product.collectionIds || [],
          isCouponEligible: product.isCouponEligible !== false,
          unitPrice: effectivePrice,
          quantity: item.quantity
        };
      });


      // Re-validate scope before computing discount
      await couponService.revalidateAtOrderCreation(couponCode, enrichedCartItems);

      // Full validation — computes discountAmount and isFreeShipping
      const userId = user ? user.id : undefined;
      const validationResult = await couponService.validateCoupon(
        couponCode,
        enrichedCartItems,
        userId
      );
      discountAmount = validationResult.discountAmount;
      isFreeShipping = validationResult.isFreeShipping;
      couponDoc = validationResult.coupon;
    }

    // ── 4. Compute shipping charge ─────────────────────────────────────────
    const threshold = getFreeShippingThreshold();
    let shippingCharge;
    if (isFreeShipping || subtotal >= threshold || subtotal - discountAmount >= threshold) {
      shippingCharge = 0;
    } else {
      shippingCharge = 99; // flat rate
    }


    // ── 5. Tax amount (GST not in scope yet) ───────────────────────────────
    const taxAmount = 0;

    // ── 6. Compute total ───────────────────────────────────────────────────
    const total = subtotal - discountAmount + shippingCharge + taxAmount;

    // ── 7. Client-total mismatch guard ─────────────────────────────────────
    if (clientTotal !== undefined && clientTotal !== null) {
      if (Math.abs(total - clientTotal) > 0.01) {
        throw createError(ERROR.PRICE_MISMATCH, 422, 'PRICE_MISMATCH');
      }
    }

    // ── 8-12. Reserve stock, reserve coupon usage, and create the order ────
    //
    // These steps must be all-or-nothing: reserving stock or a coupon slot
    // and then failing to save the order (or vice versa) would either leak
    // inventory/coupon capacity or create an order nobody paid for.
    //
    // On a replica-set/Atlas deployment (the standard for production) we run
    // the whole block inside a real MongoDB transaction, so a failure at any
    // point atomically discards every write with zero manual compensation.
    // On a standalone MongoDB instance (some local dev setups), transactions
    // aren't available; `_reserveAndCreateOrder` degrades gracefully to a
    // manual reserve-then-compensate saga in that case, executing the exact
    // same steps with each partial success. explicitly rolled back on failure.
    const ctx = {
      payloadItems, couponCode, couponDoc, discountAmount, shippingCharge,
      taxAmount, subtotal, total, paymentMethod, shippingAddress, guestEmail,
      user, variantMap, productMap
    };

    let savedOrder;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        savedOrder = await this._reserveAndCreateOrder(ctx, session);
      });
    } catch (err) {
      if (isTransactionsUnsupportedError(err)) {
        logger.warn(
          'MongoDB transactions unsupported on this deployment (standalone instance) — ' +
          'falling back to manual saga for order creation.'
        );
        savedOrder = await this._reserveAndCreateOrder(ctx, null);
      } else {
        throw err;
      }
    } finally {
      await session.endSession();
    }

    logger.info(`Order created: ${savedOrder.orderNumber} (${savedOrder._id})`);

    // Create Admin Notification
    try {
      await AdminNotification.create({
        title: 'New Order Placed',
        message: `Order #${savedOrder.orderNumber} has been placed.`,
        type: 'order_placed',
        relatedId: savedOrder._id,
      });
    } catch (err) {
      logger.error(`Failed to create admin notification for order ${savedOrder._id}: ${err.message}`);
    }

    return savedOrder;
  }

  /**
   * Reserve stock + coupon usage and persist the Order/OrderItem documents.
   * Shared by the transactional and manual-saga paths in `createOrder` — see
   * the comment there for why both exist.
   *
   * @param {Object} ctx - Order-creation context assembled by `createOrder`.
   * @param {import('mongoose').ClientSession|null} session - Active Mongo
   *        session to run every write on, or null to run without one (manual
   *        saga fallback — see `isTransactionsUnsupportedError`).
   * @returns {Promise<Object>} The saved Order document.
   */
  async _reserveAndCreateOrder(ctx, session) {
    const {
      payloadItems, couponCode, couponDoc, discountAmount, shippingCharge,
      taxAmount, subtotal, total, paymentMethod, shippingAddress, guestEmail,
      user, variantMap, productMap
    } = ctx;
    const opts = session ? { session } : {};

    // ── 8. Reserve / Deduct stock (with rollback on partial failure) ───────
    const reserved = []; // track successfully reserved items for potential rollback
    try {
      for (const item of payloadItems) {
        if (paymentMethod === 'cod') {
          // For Cash on Delivery orders, deduct physical stock immediately in MongoDB
          await variantService.deductStock(item.variantId, item.quantity, opts);
        } else {
          await variantService.reserveStock(item.variantId, item.quantity, opts);
        }
        reserved.push(item);
      }
    } catch (reserveErr) {
      for (const reservedItem of reserved) {
        try {
          await variantService.releaseStock(reservedItem.variantId, reservedItem.quantity, opts);
        } catch (releaseErr) {
          logger.error(
            `Stock rollback failed for variant ${reservedItem.variantId}: ${releaseErr.message}`
          );
        }
      }
      throw reserveErr;
    }

    // ── 8b. Reserve coupon usage atomically, in the same all-or-nothing unit
    // as the stock reservation above (previously this only happened later, at
    // the Paid transition, non-atomically w.r.t. order creation — allowing
    // more orders to apply a coupon's discount than its usage limit allowed).
    let couponReserved = false;
    if (couponCode) {
      try {
        await couponService.applyCoupon(couponCode, null, user ? user.id : null, opts);
        couponReserved = true;
      } catch (couponErr) {
        for (const reservedItem of reserved) {
          try {
            await variantService.releaseStock(reservedItem.variantId, reservedItem.quantity, opts);
          } catch (releaseErr) {
            logger.error(
              `Stock rollback after coupon-reservation failure failed for variant ${reservedItem.variantId}: ${releaseErr.message}`
            );
          }
        }
        throw couponErr;
      }
    }

    // ── 9. Capture item snapshots ──────────────────────────────────────────
    const itemSnapshots = payloadItems.map(item => {
      const variant = variantMap.get(item.variantId.toString());
      const product = productMap.get(variant.productId.toString()) || {};
      const effectivePrice = Number(product.basePrice ?? variant.price ?? 0);
      const primaryImage =
        (product.images || []).find(img => img.role === 'primary')?.url ||
        (product.images || [])[0]?.url ||
        null;
      return {
        variantId:    variant._id,
        productId:    variant.productId,
        productTitle: product.title || '',
        productImage: primaryImage,
        sku:          variant.sku,
        size:         variant.size,
        color:        variant.color,
        fabric:       variant.fabric,
        quantity:     item.quantity,
        unitPrice:    effectivePrice,
        mrp:          product.mrp || null,
        lineTotal:    effectivePrice * item.quantity
      };
    });


    const rollbackReservations = async () => {
      for (const item of payloadItems) {
        try {
          await variantService.releaseStock(item.variantId, item.quantity, opts);
        } catch (releaseErr) {
          logger.error(
            `Stock rollback on save-failure failed for variant ${item.variantId}: ${releaseErr.message}`
          );
        }
      }
      if (couponReserved) {
        try {
          await couponService.releaseCoupon(couponCode, null, opts);
        } catch (releaseErr) {
          logger.error(`Coupon rollback on save-failure failed for code ${couponCode}: ${releaseErr.message}`);
        }
      }
    };

    // ── 10. Generate atomic order number ───────────────────────────────────
    let counterDoc;
    try {
      counterDoc = await mongoose.connection.db.collection('counters').findOneAndUpdate(
        { _id: 'order_number' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after', session: session || undefined }
      );
    } catch (counterErr) {
      await rollbackReservations();
      throw counterErr;
    }
    const seq = counterDoc.seq;
    const year = new Date().getFullYear();
    const orderNumber = `MC-${year}-${String(seq).padStart(5, '0')}`;

    // ── 11. Create OrderItem documents ─────────────────────────────────────
    const OrderItem = __imp10;

    let savedOrder;
    try {
      const orderItemDocs = await OrderItem.insertMany(
        itemSnapshots.map(snap => ({
          orderId:      new mongoose.Types.ObjectId(), // patched below
          productId:    snap.productId,
          variantId:    snap.variantId,
          productTitle: snap.productTitle,
          productImage: snap.productImage || null,
          sku:          snap.sku,
          size:         snap.size,
          color:        snap.color,
          fabric:       snap.fabric,
          quantity:     snap.quantity,
          unitPrice:    snap.unitPrice,
          mrp:          snap.mrp || null,
          lineTotal:    snap.lineTotal,
        })),
        opts
      );

      // ── 12. Build the Order document ──────────────────────────────────────
      const initialHistoryEntry = {
        status: 'Created',
        timestamp: new Date(),
        actorId: user ? user.id : null,
        actorEmail: user ? user.email : null,
        note: 'Order created'
      };

      const orderData = {
        orderNumber,
        userId: user ? user.id : null,
        guestEmail: guestEmail || null,
        items: orderItemDocs.map(doc => doc._id),
        shippingAddress,
        couponId: couponDoc ? couponDoc._id : null,
        couponCode: couponCode || null,
        discountAmount,
        shippingCharge,
        taxAmount,
        subtotal,
        total,
        paymentMethod,
        status: 'Created',
        statusHistory: [initialHistoryEntry]
      };

      savedOrder = await orderRepository.create(orderData, opts);

      // Patch orderId on each OrderItem now that we have the real order _id
      await OrderItem.updateMany(
        { _id: { $in: orderItemDocs.map(d => d._id) } },
        { $set: { orderId: savedOrder._id } },
        opts
      );
    } catch (saveErr) {
      logger.error(`Order save failed after stock/coupon reservation: ${saveErr.message}`);
      await rollbackReservations();
      throw saveErr;
    }

    return savedOrder;
  }

  /**
   * Transition an order to a new status.
   *
   * @param {string|ObjectId} orderId   - Order ObjectId.
   * @param {string}          newStatus - Target status.
   * @param {Object}          actor     - { id, email } of the actor.
   * @param {string}          [note]    - Optional human-readable note.
   * @returns {Promise<Object>} Updated lean order document.
   */
  async transitionStatus(orderId, newStatus, actor, note) {
    // ── 1. Fetch the order ─────────────────────────────────────────────────
    const order = await orderRepository.findById(orderId, { populate: true });
    if (!order) {
      throw createError(ERROR.NOT_FOUND, 404, 'ORDER_NOT_FOUND');
    }

    // ── 1b. Idempotent no-op ────────────────────────────────────────────────
    // Webhooks and payment-verification calls can legitimately be retried
    // (network blips, at-least-once delivery). If the order is already at the
    // requested status, treat it as success rather than an error so retries
    // are always safe.
    if (order.status === newStatus) {
      return order;
    }

    // ── 2. Validate the transition ─────────────────────────────────────────
    const isAdmin = actor && (actor.role === 'ADMIN' || actor.isAdmin);
    if (!isAdmin && !isValidTransition(order.status, newStatus)) {
      throw createError(ERROR.INVALID_TRANSITION, 409, 'INVALID_TRANSITION');
    }


    // ── 3. Build history entry ─────────────────────────────────────────────
    const historyEntry = {
      status: newStatus,
      timestamp: new Date(),
      actorId: actor ? actor.id : null,
      actorEmail: actor ? actor.email : null,
      note: note || null
    };

    // ── 4. Persist new status (optimistic concurrency) ─────────────────────
    // The write is conditioned on the order's status still matching what we
    // just read (`expectedCurrentStatus`). If a concurrent request already
    // moved the order elsewhere, this returns null instead of silently
    // clobbering that write.
    let updatedOrder = await orderRepository.updateStatus(orderId, newStatus, historyEntry, {
      expectedCurrentStatus: order.status
    });

    if (!updatedOrder) {
      const latest = await orderRepository.findById(orderId);
      if (latest && latest.status === newStatus) {
        // A concurrent transition already got the order to where we wanted —
        // idempotent success, side effects were already applied by that call.
        return latest;
      }
      throw createError(ERROR.CONCURRENT_UPDATE, 409, 'CONCURRENT_UPDATE');
    }

    // ── 5. Side effects on Cancelled / Failed ───────────────────────────────
    // Both states mean the order will never be paid, so release everything
    // that was reserved for it at creation time — stock *and* the coupon
    // usage slot (previously only stock was released here, and only on
    // Cancelled; a Failed payment left reserved stock stuck forever, and
    // coupon usage was never released on either path).
    if (newStatus === 'Cancelled' || newStatus === 'Failed') {
      for (const item of order.items) {
        try {
          await variantService.releaseStock(item.variantId, item.quantity);
        } catch (err) {
          logger.error(
            `Stock release failed on ${newStatus} for variant ${item.variantId}: ${err.message}`
          );
        }
      }
      if (order.couponCode) {
        try {
          await couponService.releaseCoupon(order.couponCode, order._id);
        } catch (err) {
          logger.error(`Coupon release failed on ${newStatus} for order ${orderId}: ${err.message}`);
        }
      }
    }

    // ── 6. Side effects on Paid ────────────────────────────────────────────
    // Coupon usage was already reserved atomically at order-creation time
    // (see `_reserveAndCreateOrder`), so there's nothing further to do for
    // the coupon here — only confirm the stock reservation.
    if (newStatus === 'Paid') {
      for (const item of order.items) {
        try {
          await variantService.confirmStock(item.variantId, item.quantity);
        } catch (err) {
          logger.error(
            `Stock confirmation failed on Paid for variant ${item.variantId}: ${err.message}`
          );
        }
      }
    }

    // ── 6b. Sync Exchange status if transitioning to an Exchange state ─────
    const exchangeStates = [
      'ExchangeRequested', 'ExchangeApproved', 'ExchangeRejected',
      'ExchangePickupScheduled', 'ExchangeInTransit', 'QCPassed',
      'QCFailed', 'ReplacementShipped', 'ExchangeCompleted'
    ];
    if (exchangeStates.includes(newStatus)) {
      try {
        const exchangeRepository = __imp11;
        const exchanges = await exchangeRepository.findByOrderId(orderId);
        if (exchanges && exchanges.length > 0) {
          // Update the most recent exchange
          const latestExchange = exchanges.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          if (latestExchange && latestExchange.status !== newStatus) {
            await exchangeRepository.updateStatus(latestExchange._id, newStatus);
          }
        }
      } catch (err) {
        logger.error(`Exchange status sync failed on ${newStatus} for order ${orderId}: ${err.message}`);
      }
    }

    logger.info(
      `Order ${orderId} transitioned: ${order.status} → ${newStatus}` +
      (actor ? ` by ${actor.email || actor.id}` : '')
    );

    // ── 7. Fire-and-forget notifications for key order status transitions ──
    const notifyStatuses = ['Paid', 'Shipped', 'OutForDelivery', 'Delivered'];
    if (notifyStatuses.includes(newStatus)) {
      // Resolve recipient email: registered user email or guest email
      (async () => {
        try {
          const User = __imp12;
          const userDoc = order.userId
            ? await User.findById(order.userId).select('email').lean()
            : null;
          const recipientEmail = userDoc?.email || order.guestEmail;

          if (recipientEmail) {
            if (newStatus === 'Paid') {
              notificationService.send('order_confirmation', recipientEmail, { orderNumber: order.orderNumber, total: order.total }, order.userId);
            } else if (newStatus === 'Shipped') {
              notificationService.send('order_shipped', recipientEmail, { orderNumber: order.orderNumber }, order.userId);
            } else if (newStatus === 'OutForDelivery') {
              notificationService.send('order_out_for_delivery', recipientEmail, { orderNumber: order.orderNumber }, order.userId);
            } else if (newStatus === 'Delivered') {
              notificationService.send('order_delivered', recipientEmail, { orderNumber: order.orderNumber }, order.userId);
            }
          }
        } catch (err) {
          logger.warn(`Failed to resolve recipient for order notification (order ${orderId}): ${err.message}`);
        }
      })();
    }

    return updatedOrder;
  }

  /**
   * Advance an order to a target status, automatically walking through any
   * mandatory intermediate states along the way.
   *
   * Use this (instead of calling `transitionStatus` directly) from
   * *automated* call sites — payment webhooks, payment verification,
   * shipment tracking updates — where the caller knows the order should end
   * up at `targetStatus` but isn't the source of truth for exactly which
   * intermediate states the state machine requires to get there. This is
   * what closes the gap that used to make `Created -> Paid` (and the
   * equivalent exchange-flow jump) fail outright: nothing in the codebase
   * ever performed the required `Created -> Pending` hop, so the direct
   * transition always threw `INVALID_TRANSITION`.
   *
   * Explicit, single-hop actions initiated directly by an admin or a
   * customer (manual status override, cancel) should keep calling
   * `transitionStatus` — a request for one specific hop should fail loudly
   * if that exact hop isn't valid, rather than silently walking somewhere
   * else.
   *
   * Idempotent: a no-op if the order is already at `targetStatus`. Logs and
   * returns the order unchanged (does not throw) if no path exists — this is
   * called from best-effort/fire-and-forget contexts (webhooks) where the
   * caller already has its own handling for "nothing to do here".
   *
   * @param {string|ObjectId} orderId
   * @param {string} targetStatus
   * @param {Object} actor
   * @param {string} [note]
   * @returns {Promise<Object>} The order at (or already at) `targetStatus`.
   */
  async advanceTo(orderId, targetStatus, actor, note) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw createError(ERROR.NOT_FOUND, 404, 'ORDER_NOT_FOUND');
    }

    if (order.status === targetStatus) {
      return order; // already there — idempotent no-op
    }

    const path = findPath(TRANSITIONS, order.status, targetStatus);
    if (!path) {
      logger.error(
        `advanceTo: no valid path from "${order.status}" to "${targetStatus}" for order ${orderId} — leaving order unchanged.`
      );
      return order;
    }

    let current = order;
    for (const hop of path) {
      current = await this.transitionStatus(orderId, hop, actor, note);
    }
    return current;
  }

  /**
   * Cancel an order on behalf of a customer.
   *
   * @param {string|ObjectId} orderId - Order ObjectId.
   * @param {string|ObjectId} userId  - Customer ObjectId requesting cancellation.
   * @returns {Promise<Object>} Updated lean order document.
   */
  async cancelOrder(orderId, userId) {
    // ── 1. Fetch the order ─────────────────────────────────────────────────
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw createError(ERROR.NOT_FOUND, 404, 'ORDER_NOT_FOUND');
    }

    // ── 2. Ownership check ──────────────────────────────────────────────────
    // Must hold for guest orders too: `order.userId` is null on a guest
    // order, and this method is only ever reached via an authenticated
    // route, so treat "no owner on record" as "not yours" rather than
    // skipping the check — otherwise any logged-in user could cancel any
    // guest order just by knowing its id.
    if (!order.userId || order.userId.toString() !== userId.toString()) {
      throw createError(ERROR.FORBIDDEN, 403, 'FORBIDDEN');
    }

    // ── 3. Guard: order must be in a cancellable state ─────────────────────
    const NON_CANCELLABLE = [
      'Shipped', 'OutForDelivery', 'Delivered',
      'ExchangeRequested', 'ExchangeApproved', 'ExchangeRejected',
      'ExchangePickupScheduled', 'ExchangeInTransit', 'ReplacementShipped',
      'ExchangeCompleted'
    ];
    if (NON_CANCELLABLE.includes(order.status)) {
      throw createError(ERROR.ORDER_NOT_CANCELLABLE, 409, 'ORDER_NOT_CANCELLABLE');
    }

    // ── 4. Transition to Cancelled ─────────────────────────────────────────
    const updatedOrder = await this.transitionStatus(
      orderId,
      'Cancelled',
      { id: userId },
      'Customer cancellation'
    );

    // ── 5. Return updated order ────────────────────────────────────────────
    logger.info(`Order ${orderId} cancelled by customer ${userId}`);

    // Create Admin Notification
    try {
      await AdminNotification.create({
        title: 'Order Cancelled',
        message: `Order #${updatedOrder.orderNumber} has been cancelled by the customer.`,
        type: 'order_cancelled',
        relatedId: updatedOrder._id,
      });
    } catch (err) {
      logger.error(`Failed to create admin notification for cancelled order ${orderId}: ${err.message}`);
    }

    return updatedOrder;
  }
}

const __exports: any = new OrderService();

export default __exports;
