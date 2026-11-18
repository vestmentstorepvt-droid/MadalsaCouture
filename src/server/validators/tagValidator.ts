// @ts-nocheck — ported from the Express backend (validators/tagValidator.js); logic unchanged.
import * as __imp0 from "zod";

const { z } = __imp0;

// ---------------------------------------------------------------------------
// 1. createTagSchema — POST /api/v1/admin/tags
// ---------------------------------------------------------------------------

const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required')
});

// ---------------------------------------------------------------------------
// 2. updateTagSchema — PATCH /api/v1/admin/tags/:id
//    Same shape as create but every field is optional.
// ---------------------------------------------------------------------------

const updateTagSchema = createTagSchema.partial();

// ---------------------------------------------------------------------------
// Middleware factory — validateRequest(schema)
//
// Returns an Express middleware that validates `req.body` against the
// provided Zod schema. On success it replaces `req.body` with the
// parsed (sanitised) data and calls `next()`. On failure it returns a
// 400 JSON response using the project's error envelope.
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
  createTagSchema,
  updateTagSchema,
  validateRequest
};

export default __exports;
