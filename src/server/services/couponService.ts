// @ts-nocheck — ported from the Express backend (services/couponService.js); logic unchanged.
import __imp0 from "@/server/repositories/couponRepository";
import { escapeHtml, plainLine } from "@/server/utils/escapeHtml";
import __imp1 from "@/server/constants/messages";
import __imp2 from "@/server/config/logger";
import __imp3 from "@/server/emails/mailer";
import __imp4 from "@/server/models/couponModel";
import __imp5 from "@/server/modules/cms/banners/banner.model";
import __imp6 from "@/server/lib/mongoose";

const couponRepository = __imp0;
const { ERROR } = __imp1;
const logger = __imp2;

/**
 * Helper — build a standardised service error.
 * @param {string} message     - Human-readable message (from ERROR constants).
 * @param {number} statusCode  - HTTP status code.
 * @param {string} [code]      - SNAKE_CASE error code sent in the JSON response.
 * @returns {Error}
 */
function createError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code: code || 'REQUEST_ERROR' });
}

/**
 * Check whether at least one cart item matches the coupon's scope.
 *
 * Scope is considered "open" (applies to everything) when all three
 * arrays – categoryIds, collectionIds, productIds – are empty.
 * When any array is non-empty, at least one cart item must match
 * one of the IDs in that array.
 *
 * @param {Object}   scope     - Coupon scope subdocument.
 * @param {Object[]} cartItems - Array of cart item objects.
 * @returns {boolean} true if the coupon applies to the given cart.
 */
function cartMatchesScope(scope, cartItems) {
  const { categoryIds = [], collectionIds = [], productIds = [] } = scope || {};

  // No scope restrictions — coupon is universal.
  const hasScope =
    categoryIds.length > 0 || collectionIds.length > 0 || productIds.length > 0;
  if (!hasScope) return true;

  // Convert scope IDs to plain strings once for fast comparison.
  const catSet  = new Set(categoryIds.map(id => id.toString()));
  const colSet  = new Set(collectionIds.map(id => id.toString()));
  const prodSet = new Set(productIds.map(id => id.toString()));

  return cartItems.some(item => {
    // Match by productId
    if (prodSet.size > 0 && item.productId && prodSet.has(item.productId.toString())) {
      return true;
    }
    // Match by categoryId
    if (catSet.size > 0 && item.categoryId && catSet.has(item.categoryId.toString())) {
      return true;
    }
    // Match by any collectionId
    if (colSet.size > 0 && Array.isArray(item.collectionIds)) {
      return item.collectionIds.some(cid => colSet.has(cid.toString()));
    }
    return false;
  });
}

/**
 * Compute the discount amount for a given coupon and cart subtotal.
 *
 * @param {Object} coupon       - Coupon document (lean).
 * @param {number} cartSubtotal - Pre-computed sum of unitPrice * quantity.
 * @returns {{ discountAmount: number, isFreeShipping: boolean }}
 */
function computeDiscount(coupon, cartSubtotal) {
  let discountAmount = 0;
  let isFreeShipping = false;

  switch (coupon.type) {
    case 'percentage':
      discountAmount = parseFloat(
        Math.min(cartSubtotal * (coupon.value / 100), cartSubtotal).toFixed(2)
      );
      break;
    case 'flat':
      discountAmount = parseFloat(
        Math.min(coupon.value, cartSubtotal).toFixed(2)
      );
      break;
    case 'free_shipping':
      discountAmount = 0;
      isFreeShipping = true;
      break;
    default:
      discountAmount = 0;
  }

  return { discountAmount, isFreeShipping };
}

class CouponService {
  /**
   * Validate a coupon code against the current cart — READ-ONLY.
   *
   * Performs all eligibility checks (dates, limits, scope, minimum order)
   * and computes the discount amount, but does NOT write anything to the DB.
   *
   * cartItems shape:
   * [
   *   {
   *     productId:     ObjectId,
   *     variantId:     ObjectId,
   *     categoryId:    ObjectId,       // from product
   *     collectionIds: [ObjectId],     // from product
   *     unitPrice:     Number,
   *     quantity:      Number
   *   }
   * ]
   *
   * @param {string}   code      - Coupon code entered by the customer.
   * @param {Object[]} cartItems - Cart line items (see shape above).
   * @param {string}   [userId]  - Authenticated customer ObjectId (optional).
   * @returns {Promise<{ coupon: Object, discountAmount: number, isFreeShipping: boolean }>}
   */
  async validateCoupon(code, cartItems, userId) {
    // ── 1. Lookup ──────────────────────────────────────────────────────────
    const coupon = await couponRepository.findByCode(code);
    if (!coupon) {
      throw createError(ERROR.COUPON_NOT_FOUND, 404, 'COUPON_NOT_FOUND');
    }

    if (coupon.isActive === false) {
      throw createError(ERROR.COUPON_NOT_ACTIVE, 422, 'COUPON_NOT_ACTIVE');
    }

    const now = new Date();

    // ── 2. startDate check ─────────────────────────────────────────────────
    if (coupon.startDate && now < new Date(coupon.startDate)) {
      throw createError(ERROR.COUPON_NOT_ACTIVE, 422, 'COUPON_NOT_ACTIVE');
    }

    // ── 3. endDate check ───────────────────────────────────────────────────
    if (coupon.endDate && now > new Date(coupon.endDate)) {
      throw createError(ERROR.COUPON_EXPIRED, 422, 'COUPON_EXPIRED');
    }

    // ── 4. Global usage limit ──────────────────────────────────────────────
    if (
      coupon.usageLimitTotal != null &&
      coupon.usageCount >= coupon.usageLimitTotal
    ) {
      throw createError(ERROR.COUPON_EXHAUSTED, 409, 'COUPON_EXHAUSTED');
    }

    // ── 5. Per-customer usage limit ────────────────────────────────────────
    // Orders that never actually consumed the reservation (Cancelled/Failed —
    // both release their coupon reservation, see orderService) must not count
    // against the customer's limit, or a single abandoned/failed checkout
    // could permanently lock them out of a coupon they never redeemed.
    if (coupon.usageLimitPerCustomer != null && userId) {
      const mongoose = __imp6;
      const Order = mongoose.models.Order || mongoose.model('Order');
      const usedCount = await Order.countDocuments({
        userId,
        couponCode: coupon.code,
        status: { $nin: ['Cancelled', 'Failed'] }
      });
      if (usedCount >= coupon.usageLimitPerCustomer) {
        throw createError(ERROR.COUPON_LIMIT_REACHED, 409, 'COUPON_LIMIT_REACHED');
      }
    }

    // ── 6. Minimum order value ─────────────────────────────────────────────
    const cartSubtotal = (cartItems || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
      0
    );

    if (coupon.minOrderValue && cartSubtotal < coupon.minOrderValue) {
      throw createError(ERROR.COUPON_MIN_ORDER_NOT_MET, 422, 'ORDER_BELOW_MINIMUM');
    }

    // ── 7. Scope check ─────────────────────────────────────────────────────
    if (!cartMatchesScope(coupon.scope, cartItems || [])) {
      throw createError(ERROR.COUPON_SCOPE_MISMATCH, 422, 'COUPON_SCOPE_MISMATCH');
    }

    // ── 8. Compute discount — only on coupon-eligible items ───────────────
    // Filter out items whose product has isCouponEligible === false
    const eligibleItems = (cartItems || []).filter(item => item.isCouponEligible !== false);
    const eligibleSubtotal = eligibleItems.reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
      0
    );

    const { discountAmount, isFreeShipping } = computeDiscount(coupon, eligibleSubtotal);

    return { coupon, discountAmount, isFreeShipping };
  }

  /**
   * Atomically apply a coupon to an order, incrementing its usageCount.
   *
   * Uses a conditional findOneAndUpdate so that two concurrent requests
   * cannot both succeed when only one slot remains.
   *
   * @param {string} code    - Coupon code.
   * @param {string} orderId - ObjectId of the order being placed.
   * @param {string} userId  - ObjectId of the customer placing the order.
   * @returns {Promise<Object>} The updated coupon document.
   */
  async applyCoupon(code, orderId, userId, options = {}) {
    // We need usageLimitTotal from the coupon to pass to atomicIncrementUsage.
    // Fetch it first (read-only).
    const coupon = await couponRepository.findByCode(code);
    if (!coupon) {
      throw createError(ERROR.COUPON_NOT_FOUND, 404, 'COUPON_NOT_FOUND');
    }

    const updated = await couponRepository.atomicIncrementUsage(
      code,
      coupon.usageLimitTotal,
      options
    );

    if (!updated) {
      throw createError(ERROR.COUPON_EXHAUSTED, 409, 'COUPON_EXHAUSTED');
    }

    logger.info(
      `Coupon applied: code=${code} orderId=${orderId} userId=${userId} ` +
      `usageCount=${updated.usageCount}`
    );

    return updated;
  }

  /**
   * Compensating action for `applyCoupon` — releases a reserved usage slot
   * when the order that reserved it is cancelled or fails before payment.
   * Best-effort: swallows "coupon not found" (e.g. deleted after use) since
   * there's nothing meaningful to compensate at that point, but logs
   * everything for reconciliation.
   *
   * @param {string} code    - Coupon code.
   * @param {string} orderId - ObjectId of the order being released.
   */
  async releaseCoupon(code, orderId, options = {}) {
    try {
      const updated = await couponRepository.atomicReleaseUsage(code, options);
      if (updated) {
        logger.info(
          `Coupon usage released: code=${code} orderId=${orderId} ` +
          `usageCount=${updated.usageCount}`
        );
      }
      return updated;
    } catch (err) {
      logger.error(`Failed to release coupon usage: code=${code} orderId=${orderId} — ${err.message}`);
      // Non-fatal: this runs as a compensating step, not the primary flow.
      return null;
    }
  }

  /**
   * Re-validate a coupon immediately before order creation to guard against
   * stale cart state (e.g. items changed between "validate" and "place order").
   *
   * Checks dates and scope only — does NOT increment usageCount.
   *
   * @param {string}   code      - Coupon code.
   * @param {Object[]} cartItems - Final cart items at the moment of order creation.
   * @returns {Promise<Object>} The coupon document if still valid.
   */
  async revalidateAtOrderCreation(code, cartItems) {
    const coupon = await couponRepository.findByCode(code);
    if (!coupon) {
      throw createError(ERROR.COUPON_NO_LONGER_VALID, 422, 'COUPON_NO_LONGER_VALID');
    }

    if (coupon.isActive === false) {
      throw createError(ERROR.COUPON_NO_LONGER_VALID, 422, 'COUPON_NO_LONGER_VALID');
    }

    const now = new Date();

    // Re-check dates
    if (coupon.startDate && now < new Date(coupon.startDate)) {
      throw createError(ERROR.COUPON_NO_LONGER_VALID, 422, 'COUPON_NO_LONGER_VALID');
    }
    if (coupon.endDate && now > new Date(coupon.endDate)) {
      throw createError(ERROR.COUPON_NO_LONGER_VALID, 422, 'COUPON_NO_LONGER_VALID');
    }

    // Re-check scope against the final cart
    if (!cartMatchesScope(coupon.scope, cartItems || [])) {
      throw createError(ERROR.COUPON_NO_LONGER_VALID, 422, 'COUPON_NO_LONGER_VALID');
    }

    return coupon;
  }

  async listActiveCoupons() {
    const Coupon = __imp4;
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      isDeleted: false,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] }
      ]
    }).lean();

    return coupons;
  }

  async claimPromoCoupon(email, firstName) {
    const { sendMail } = __imp3;
    const Coupon = __imp4;
    const Banner = __imp5;

    const now = new Date();
    let coupon = null;

    // 1. Check if the active festive banner has a specifically configured promo coupon code
    const activeBanner = await Banner.findOne({
      placement: 'festive',
      status: 'active',
      isDeleted: false,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }
      ]
    }).lean();

    if (activeBanner?.promoCouponCode) {
      // Look for the specific coupon matching the code from the banner
      coupon = await Coupon.findOne({
        code: activeBanner.promoCouponCode.toUpperCase(),
        isActive: true,
        isDeleted: false,
        $and: [
          { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
          { $or: [{ endDate: null }, { endDate: { $gte: now } }] }
        ]
      }).lean();
    }

    // 2. Otherwise only the public WELCOME10 code. (It used to fall back to the highest-value
    //    active coupon, which emailed private/staff codes to anyone who asked.)
    if (!coupon) {
      coupon = await Coupon.findOne({ code: 'WELCOME10', isActive: true, isDeleted: false }).lean();
    }

    let couponCode = 'WELCOME10';
    let discountDetails = '10% OFF your next purchase';

    if (coupon) {
      couponCode = coupon.code;
      if (coupon.type === 'percentage') {
        discountDetails = `${coupon.value}% OFF your next purchase`;
      } else if (coupon.type === 'flat') {
        discountDetails = `₹${coupon.value} OFF your next purchase`;
      } else if (coupon.type === 'free_shipping') {
        discountDetails = 'Free Shipping on your next purchase';
      }
    } else {
      // Fallback: If no coupons exist in DB, create a default promo coupon so it works at checkout
      try {
        const defaultCoupon = await Coupon.create({
          code: 'WELCOME10',
          type: 'percentage',
          value: 10,
          isActive: true,
          isDeleted: false,
          minOrderValue: 0,
          startDate: null,
          endDate: null,
          scope: { categoryIds: [], collectionIds: [], productIds: [] }
        });
        couponCode = defaultCoupon.code;
      } catch (err) {
        couponCode = 'WELCOME10';
      }
    }

    // 2. Format and send the promotional email
    // Typed by the visitor: plain text only, escaped for the HTML part.
    const recipientName = plainLine(firstName, 50) || 'there';
    const recipientNameHtml = escapeHtml(recipientName);
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e8e3d9; border-radius: 12px; background-color: #FAF8F5; text-align: center;">
        <h1 style="color: #6B4D3E; font-family: serif; font-size: 26px; letter-spacing: 1px; margin-bottom: 20px; margin-top: 10px;">MADALSA COUTURE</h1>
        <div style="border-top: 1px solid #D4AF37; border-bottom: 1px solid #D4AF37; padding: 20px 0; margin: 20px 0;">
          <h2 style="color: #8C6A5C; font-family: sans-serif; font-size: 18px; margin: 0 0 10px 0; letter-spacing: 0.5px;">YOUR EXCLUSIVE PROMOTIONAL OFFER</h2>
          <p style="font-size: 15px; color: #555; margin-bottom: 20px;">Dear ${recipientNameHtml}, thank you for subscribing to Madalsa Couture. Use the coupon code below to claim your exclusive offer:</p>
          <div style="display: inline-block; background-color: #271C16; color: #D4AF37; font-size: 24px; font-weight: bold; letter-spacing: 3px; padding: 12px 30px; border-radius: 6px; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">${couponCode}</div>
          <p style="font-size: 16px; font-weight: bold; color: #6B4D3E; margin: 10px 0 0 0;">${discountDetails}</p>
        </div>
        <p style="font-size: 13px; color: #777; line-height: 1.6;">
          Simply apply this code at checkout to claim your discount.
        </p>
        <div style="margin-top: 30px; font-size: 11px; color: #aaa;">
          &copy; ${new Date().getFullYear()} Madalsa Couture. All rights reserved.
        </div>
      </div>
    `;

    await sendMail({
      to: email,
      subject: 'Your Exclusive Couture Offer - Madalsa Couture',
      text: `Hello ${recipientName},\n\nThank you for subscribing to Madalsa Couture.\n\nUse the coupon code below at checkout to claim your exclusive offer:\n\nCode: ${couponCode}\nOffer: ${discountDetails}\n\nWarm regards,\nMadalsa Couture Team`,
      html: htmlContent
    });

    return {
      message: 'Promotion coupon has been sent to your email address.',
      couponCode,
      discountDetails
    };
  }
}

const __exports: any = new CouponService();

export default __exports;
