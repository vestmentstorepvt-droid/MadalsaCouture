// @ts-nocheck — ported from the Express backend (validators/orderValidator.js); logic unchanged.
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

// ---------------------------------------------------------------------------
// 1. createOrderSchema — POST /api/v1/orders
// ---------------------------------------------------------------------------

const orderItemSchema = z.object({
  productId: objectId.optional().nullable(),
  variantId: objectId.optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'quantity must be at least 1'),
  price: z.coerce.number().optional()
});

const shippingAddressSchema = z.object({
  name: z.string().min(1, 'name is required'),
  addressLine: z.string().min(1, 'addressLine is required'),
  city: z.string().min(1, 'city is required'),
  state: z.string().min(1, 'state is required'),
  pincode: z.union([z.string(), z.number()]).transform((val) => String(val).trim()),
  country: z.string().optional().default('India'),
  phone: z.union([z.string(), z.number()]).transform((val) => String(val).trim()),
  deliveryPhone: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => (val ? String(val).trim() : null))
});

const createOrderSchema = z.object({
  items: z
    .array(orderItemSchema, {
      required_error: 'items is required',
      invalid_type_error: 'items must be an array'
    })
    .min(1, 'items must contain at least one item'),

  // Either a full shipping address object OR a reference addressId can be provided
  addressId: objectId.optional().nullable(),
  shippingAddress: shippingAddressSchema.optional().nullable(),

  paymentMethod: z.enum(['online', 'cod'], {
    required_error: 'paymentMethod is required',
    invalid_type_error: "paymentMethod must be 'online' or 'cod'",
  }),

  couponCode: z.string().optional().nullable(),

  clientTotal: z.coerce.number().optional().nullable(),

  guestEmail: z
    .string()
    .email('guestEmail must be a valid email address')
    .optional()
    .nullable()
});

// ---------------------------------------------------------------------------
// 2. updateOrderStatusSchema — PATCH /api/v1/admin/orders/:id/status
// ---------------------------------------------------------------------------

const updateOrderStatusSchema = z.object({
  status: z.string({ required_error: 'status is required' }).min(1, 'status is required'),
  note: z.string().optional().nullable()
});

// ---------------------------------------------------------------------------
// 3. cancelOrderSchema — POST /api/v1/orders/:id/cancel
// ---------------------------------------------------------------------------

const cancelOrderSchema = z.object({});

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
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  validateRequest
};

export default __exports;
