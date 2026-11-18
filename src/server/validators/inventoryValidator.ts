// @ts-nocheck — ported from the Express backend (validators/inventoryValidator.js); logic unchanged.
import * as __imp0 from "zod";
import __imp1 from "@/server/constants/reasonCodes";

const { z } = __imp0;
const { INVENTORY_REASON_CODES } = __imp1;

// ---------------------------------------------------------------------------
// adjustStockSchema — PATCH /api/v1/admin/inventory/:variantId/adjust
// ---------------------------------------------------------------------------

const adjustStockSchema = z.object({
  delta: z
    .number({ required_error: 'delta is required', invalid_type_error: 'delta must be a number' })
    .int('delta must be an integer')
    .refine((v) => v !== 0, { message: 'delta cannot be zero' }),

  reasonCode: z.enum(
    /** @type {[string, ...string[]]} */ (INVENTORY_REASON_CODES),
    {
      required_error: 'reasonCode is required',
      invalid_type_error: `reasonCode must be one of: ${INVENTORY_REASON_CODES.join(', ')}`
    }
  ),

  note: z.string().optional()
});

// ---------------------------------------------------------------------------
// Middleware factory — validateRequest(schema)
//
// Validates req.body against the provided Zod schema.
// On success, replaces req.body with the parsed (sanitised) data and calls next().
// On failure, returns a 400 JSON response using the project's error envelope.
//
// @param {import('zod').ZodTypeAny} schema
// @returns {import('express').RequestHandler}
// ---------------------------------------------------------------------------

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
  adjustStockSchema,
  validateRequest
};

export default __exports;
