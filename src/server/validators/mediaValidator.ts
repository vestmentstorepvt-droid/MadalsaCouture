// @ts-nocheck — ported from the Express backend (validators/mediaValidator.js); logic unchanged.
import * as __imp0 from "zod";

const { z } = __imp0;

// ---------------------------------------------------------------------------
// listMediaSchema — GET /api/v1/admin/media
//
// Validates query-string parameters for the paginated media listing endpoint.
// All fields are optional; page and limit are coerced from strings to numbers
// (query params arrive as strings in Express).
// ---------------------------------------------------------------------------

const listMediaSchema = z.object({
  /** Target Cloudinary folder to filter by. */
  folder: z.string().optional(),

  /**
   * Tags filter — accepts either a comma-separated string
   * (e.g. "fashion,product") or an array of strings.
   * The controller is responsible for splitting string values.
   */
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional(),

  /** Cloudinary resource type filter. */
  resourceType: z
    .enum(['image', 'video', 'raw'], {
      invalid_type_error: "resourceType must be one of 'image', 'video', or 'raw'"
    })
    .optional(),

  /** Free-text search term (matched against filename / public ID). */
  search: z.string().optional(),

  /** 1-based page number — coerced from string. */
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => parseInt(v, 10))
    .refine((v) => Number.isInteger(v) && v >= 1, { message: 'page must be a positive integer' }),

  /** Items per page — coerced from string, max 100. */
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((v) => parseInt(v, 10))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 100, {
      message: 'limit must be an integer between 1 and 100'
    })
});

// ---------------------------------------------------------------------------
// deleteMediaSchema
//
// The publicId is captured from the URL path (req.params.publicId or a
// wildcard match).  Non-emptiness is enforced in the controller directly,
// so no Zod schema is required here.  The export is included for completeness
// and to document the convention.
// ---------------------------------------------------------------------------

const deleteMediaSchema = null; // public-id validated in controller

// ---------------------------------------------------------------------------
// Middleware factory — validateQuery(schema)
//
// Validates req.query against the provided Zod schema.
// On success, replaces req.query with the parsed/coerced data and calls next().
// On failure, returns a 400 JSON response using the project's error envelope.
//
// @param {import('zod').ZodTypeAny} schema
// @returns {import('express').RequestHandler}
// ---------------------------------------------------------------------------

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
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
  req.query = result.data;
  next();
};

// ---------------------------------------------------------------------------
// Middleware factory — validateRequest(schema)
//
// Validates req.body against the provided Zod schema.
// On success, replaces req.body with the parsed/sanitised data and calls next().
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
  req.body = result.data;
  next();
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const __exports: any = {
  listMediaSchema,
  deleteMediaSchema,
  validateQuery,
  validateRequest
};

export default __exports;
