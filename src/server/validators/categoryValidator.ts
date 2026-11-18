// @ts-nocheck — ported from the Express backend (validators/categoryValidator.js); logic unchanged.
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
// Shared sub-object schemas
// ---------------------------------------------------------------------------

const seoSchema = z
  .object({
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImage: z.string().optional()
  })
  .optional();

// ---------------------------------------------------------------------------
// 1. createCategorySchema — POST /api/v1/admin/categories
// ---------------------------------------------------------------------------

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  parentId: objectId.optional().nullable(),
  bannerUrl: z.string().optional(),
  description: z.string().optional(),
  seo: seoSchema,
  displayOrder: z.number().optional().default(0),
  status: z.enum(['active', 'archived']).optional()
});

// ---------------------------------------------------------------------------
// 2. updateCategorySchema — PATCH /api/v1/admin/categories/:id
//    Same shape as create but every field is optional.
// ---------------------------------------------------------------------------

const updateCategorySchema = createCategorySchema.partial();

// ---------------------------------------------------------------------------
// Middleware factory — validateRequest(schema)
//
// Follows the same response envelope used elsewhere in the project:
// { error: { code, message, details } }
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
  req.body = result.data; // use parsed/sanitised data
  next();
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const __exports: any = {
  createCategorySchema,
  updateCategorySchema,
  validateRequest
};

export default __exports;
