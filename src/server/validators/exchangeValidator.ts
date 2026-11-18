// @ts-nocheck — ported from the Express backend (validators/exchangeValidator.js); logic unchanged.
import * as __imp0 from "zod";

const { z } = __imp0;

// ---------------------------------------------------------------------------
// 1. approveExchangeSchema — PATCH /:id/approve
// ---------------------------------------------------------------------------

const approveExchangeSchema = z.object({
  note: z.string().optional()
});

// ---------------------------------------------------------------------------
// 2. rejectExchangeSchema — PATCH /:id/reject
// ---------------------------------------------------------------------------

const rejectExchangeSchema = z.object({
  note: z.string().optional()
});

// ---------------------------------------------------------------------------
// 3. qcResultSchema — PATCH /:id/qc
// ---------------------------------------------------------------------------

const qcResultSchema = z.object({
  passed: z.boolean({ required_error: 'passed is required' }),
  note: z.string().optional()
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
  approveExchangeSchema,
  rejectExchangeSchema,
  qcResultSchema,
  validateRequest
};

export default __exports;
