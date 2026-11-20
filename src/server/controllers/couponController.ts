// @ts-nocheck — ported from the Express backend (controllers/couponController.js); logic unchanged.
import __imp0 from "@/server/repositories/couponRepository";
import __imp1 from "@/server/services/couponService";
import __imp2 from "@/server/utils/response";
import __imp3 from "@/server/validators/couponValidator";

const couponRepository = __imp0;
const couponService = __imp1;
const { sendSuccess, sendError } = __imp2;
const {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
  validateRequest: validate
} = __imp3;

class CouponController {
  // ─── Admin endpoints ────────────────────────────────────────────────────────

  /**
   * POST /api/v1/admin/coupons
   * Create a new coupon.
   * Returns 409 if a coupon with the same code already exists.
   */
  async createCoupon(req, res, next) {
    try {
      // Inline validation so we can handle it before hitting the DB
      const result = createCouponSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed.', details }
        });
      }

      const data = result.data;

      // Uppercase the code before persisting (model also does this, but let's be explicit)
      if (data.code) data.code = data.code.toUpperCase();

      // Attach the admin user as createdBy
      if (req.user?.id) data.createdBy = req.user.id;

      const coupon = await couponRepository.create(data);
      return sendSuccess(res, { coupon }, 201);
    } catch (err) {
      // MongoDB duplicate key error on the unique `code` index
      if (err.code === 11000) {
        return sendError(res, 'CONFLICT', 'A coupon with this code already exists.', 409);
      }
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/coupons
   * List all coupons with optional filtering and pagination.
   *
   * Query params: page, limit, type, search
   */
  async listCoupons(req, res, next) {
    try {
      const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

      const filters = {};
      if (req.query.type)   filters.type   = req.query.type;
      if (req.query.search) filters.search = req.query.search;

      const { data, total } = await couponRepository.findAll(filters, page, limit);

      const meta = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };

      return sendSuccess(res, { coupons: data }, 200, meta);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/coupons/:id
   * Update an existing coupon.
   */
  async updateCoupon(req, res, next) {
    try {
      const result = updateCouponSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed.', details }
        });
      }

      const data = result.data;

      // Uppercase code if it's being updated
      if (data.code) data.code = data.code.toUpperCase();

      // Attach audit field
      if (req.user?.id) data.updatedBy = req.user.id;

      const coupon = await couponRepository.update(req.params.id, data);
      if (!coupon) {
        return sendError(res, 'NOT_FOUND', 'Coupon not found.', 404);
      }

      return sendSuccess(res, { coupon });
    } catch (err) {
      // Duplicate key if the code is changed to one that already exists
      if (err.code === 11000) {
        return sendError(res, 'CONFLICT', 'A coupon with this code already exists.', 409);
      }
      next(err);
    }
  }

  /**
   * DELETE /api/v1/admin/coupons/:id
   * Soft-delete a coupon.
   */
  async deleteCoupon(req, res, next) {
    try {
      const coupon = await couponRepository.softDelete(req.params.id, req.user.id);
      if (!coupon) {
        return sendError(res, 'NOT_FOUND', 'Coupon not found.', 404);
      }
      return sendSuccess(res, { coupon });
    } catch (err) {
      next(err);
    }
  }

  // ─── Public endpoints ────────────────────────────────────────────────────────

  /**
   * POST /api/v1/coupons/validate
   * Validate a coupon code against the current cart and return the discount.
   * Does NOT require authentication (req.user may be undefined).
   */
  async validateCouponHandler(req, res, next) {
    try {
      const result = validateCouponSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed.', details }
        });
      }

      let { code, cartItems, cartTotal, cartSubtotal } = result.data;
      const effectiveTotal = cartTotal ?? cartSubtotal ?? 0;

      let normalizedItems = (cartItems || []).map((item) => ({
        ...item,
        unitPrice: item.unitPrice ?? item.price ?? 0,
        quantity: item.quantity ?? 1
      }));

      if (normalizedItems.length === 0 && effectiveTotal > 0) {
        normalizedItems = [{ unitPrice: effectiveTotal, quantity: 1 }];
      }

      const { discountAmount, isFreeShipping } = await couponService.validateCoupon(
        code,
        normalizedItems,
        req.user?.id
      );

      return sendSuccess(res, { discountAmount, isFreeShipping });

    } catch (err) {
      next(err);
    }
  }

  async getActiveCoupons(req, res, next) {
    try {
      const coupons = await couponService.listActiveCoupons();
      return sendSuccess(res, { coupons });
    } catch (err) {
      next(err);
    }
  }

  async claimPromoCoupon(req, res, next) {
    try {
      const { email, firstName } = req.body;
      // One plain address only (no lists, display names or comments).
      if (typeof email !== 'string' || email.length > 200 || !/^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/.test(email.trim())) {
        return res.status(400).json({ error: { message: 'Please enter a valid email address.' } });
      }
      const result = await couponService.claimPromoCoupon(email.trim(), (firstName || '').trim());
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}

const __exports: any = new CouponController();

export default __exports;
