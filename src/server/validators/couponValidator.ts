// @ts-nocheck — ported from the Express backend (validators/couponValidator.js); logic unchanged.
import * as __imp0 from "zod";

const { z } = __imp0;

// ---------------------------------------------------------------------------
// Reusable helpers
// ---------------------------------------------------------------------------

/**
 * Validates a MongoDB ObjectId string (24-character hex).
 */
const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid MongoDB ObjectId');

/**
 * Optional array of ObjectId strings.
 */
const objectIdArray = z.array(objectId).optional();

// ---------------------------------------------------------------------------
// Base coupon object shape — shared by create and update schemas
// ---------------------------------------------------------------------------

const couponBaseObject = z.object({
  code: z.string().min(1, 'Coupon code is required'),

  type: z.enum(['percentage', 'flat', 'free_shipping'], {
    error: "type must be one of 'percentage', 'flat', or 'free_shipping'"
  }),

  /**
   * value is required when type is 'percentage' or 'flat'.
   * For 'free_shipping' it is not applicable and can be omitted.
   */
  value: z
    .number({ error: 'value must be a number' })
    .optional(),

  minOrderValue: z
    .number({ error: 'minOrderValue must be a number' })
    .min(0, 'minOrderValue must be >= 0')
    .optional(),

  scope: z
    .object({
      categoryIds: objectIdArray,
      collectionIds: objectIdArray,
      productIds: objectIdArray
    })
    .optional(),

  startDate: z
    .union([
      z.iso.datetime({ message: 'startDate must be a valid ISO 8601 date-time string' }),
      z.string().date('startDate must be a valid date (YYYY-MM-DD)')
    ])
    .nullable()
    .optional(),

  endDate: z
    .union([
      z.iso.datetime({ message: 'endDate must be a valid ISO 8601 date-time string' }),
      z.string().date('endDate must be a valid date (YYYY-MM-DD)')
    ])
    .nullable()
    .optional(),

  usageLimitTotal: z
    .number({ error: 'usageLimitTotal must be a number' })
    .int('usageLimitTotal must be an integer')
    .min(1, 'usageLimitTotal must be >= 1')
    .nullable()
    .optional(),

  usageLimitPerCustomer: z
    .number({ error: 'usageLimitPerCustomer must be a number' })
    .int('usageLimitPerCustomer must be an integer')
    .min(1, 'usageLimitPerCustomer must be >= 1')
    .nullable()
    .optional(),

  isActive: z.boolean().optional()
});

// ---------------------------------------------------------------------------
// 1. createCouponSchema — POST /api/v1/admin/coupons
// ---------------------------------------------------------------------------

const createCouponSchema = couponBaseObject.superRefine((data, ctx) => {
  // value is required when type is 'percentage' or 'flat'
  if (
    (data.type === 'percentage' || data.type === 'flat') &&
    (data.value === undefined || data.value === null)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: `value is required when type is '${data.type}'`
    });
  }

  // percentage value must be between 0 and 100
  if (data.type === 'percentage' && data.value !== undefined) {
    if (data.value < 0 || data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'value must be between 0 and 100 for percentage coupons'
      });
    }
  }

  // flat value must be > 0
  if (data.type === 'flat' && data.value !== undefined) {
    if (data.value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'value must be greater than 0 for flat coupons'
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 2. updateCouponSchema — PATCH /api/v1/admin/coupons/:id
//    Same shape as create but all fields are optional (partial).
//    Cross-field validation is intentionally omitted on partial updates.
// ---------------------------------------------------------------------------

const updateCouponSchema = couponBaseObject.partial();

// ---------------------------------------------------------------------------
// 3. validateCouponSchema — POST /api/v1/coupons/validate
// ---------------------------------------------------------------------------

const cartItemSchema = z.object({
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  collectionIds: z.array(z.string()).optional(),
  unitPrice: z
    .number({ invalid_type_error: 'unitPrice must be a number' })
    .min(0, 'unitPrice must be >= 0')
    .optional(),
  price: z.number().optional(),
  quantity: z
    .number({ invalid_type_error: 'quantity must be a number' })
    .int('quantity must be an integer')
    .min(1, 'quantity must be >= 1')
    .optional()
    .default(1)
});

const validateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  cartTotal: z.number().optional(),
  cartSubtotal: z.number().optional(),
  cartItems: z
    .array(cartItemSchema)
    .optional()
    .default([])
});


// ---------------------------------------------------------------------------
// Middleware factory — validateRequest(schema)
// ---------------------------------------------------------------------------

/**
 * Returns an Express middleware that validates `req.body` against the
 * provided Zod schema. On success it replaces `req.body` with the
 * parsed (sanitised) data and calls `next()`. On failure it returns a
 * 400 JSON response using the project's error envelope.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues ?? result.error.errors ?? [];
    const details = issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        details
      }
    });
  }
  req.body = result.data;
  next();
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const __exports: any = {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
  validateRequest
};

export default __exports;
