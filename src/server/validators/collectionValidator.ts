// @ts-nocheck — ported from the Express backend (validators/collectionValidator.js); logic unchanged.
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
// Sub-object schemas
// ---------------------------------------------------------------------------

/**
 * A single rule entry for rule-based collections.
 * { field: 'categoryId', operator: 'eq', value: '<someId>' }
 */
const ruleSchema = z.object({
  field:    z.string().min(1, 'Rule field is required'),
  operator: z.string().min(1, 'Rule operator is required'),
  value:    z.any()
});

// ---------------------------------------------------------------------------
// 1. createCollectionSchema — POST /api/v1/admin/collections
// ---------------------------------------------------------------------------

const createCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required'),

  description: z.string().optional(),

  type: z.enum(['manual', 'rule-based'], {
    required_error: "Type is required. Must be 'manual' or 'rule-based'."
  }),

  productIds: z.array(objectId).optional(),

  rules: z.array(ruleSchema).optional(),

  startsAt: z
    .string()
    .datetime({ message: 'startsAt must be a valid ISO 8601 date string' })
    .optional(),

  endsAt: z
    .string()
    .datetime({ message: 'endsAt must be a valid ISO 8601 date string' })
    .optional(),

  status: z.enum(['active', 'inactive']).optional()
});

// ---------------------------------------------------------------------------
// 2. updateCollectionSchema — PATCH /api/v1/admin/collections/:id
//    All fields optional via .partial()
// ---------------------------------------------------------------------------

const updateCollectionSchema = createCollectionSchema.partial();

// ---------------------------------------------------------------------------
// Middleware factory — validateRequest(schema)
//
// Returns an Express middleware that validates req.body against the given
// Zod schema. On success, replaces req.body with the parsed data and calls
// next(). On failure, returns a 400 response using the project's error envelope.
// ---------------------------------------------------------------------------

/**
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues ?? result.error.errors ?? [];
    const details = issues.map((e) => ({
      field:   e.path.join('.'),
      message: e.message
    }));
    return res.status(400).json({
      error: {
        code:    'VALIDATION_ERROR',
        message: 'Validation failed.',
        details
      }
    });
  }
  req.body = result.data; // replace with sanitised/coerced data
  next();
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const __exports: any = {
  createCollectionSchema,
  updateCollectionSchema,
  validateRequest
};

export default __exports;
