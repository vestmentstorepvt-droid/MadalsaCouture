// @ts-nocheck — ported from the Express backend (validators/variantValidator.js); logic unchanged.
import * as __imp0 from "zod";

const { z } = __imp0;

// ---------------------------------------------------------------------------
// Shared image sub-schema — matches productModel.imageObjectSchema
// ---------------------------------------------------------------------------
const imageObjectSchema = z.object({
  url:       z.string().url('Must be a valid URL'),
  altText:   z.string().optional().default(''),
  role:      z.enum(['primary', 'gallery', 'hover', 'sizeChart', 'lifestyle', 'back', 'side', 'closeup', 'video', '360']).optional().default('gallery'),
  sortOrder: z.number().optional().default(0),
});

// ---------------------------------------------------------------------------
// Dimensions sub-schema
// ---------------------------------------------------------------------------
const variantDimensionsSchema = z.object({
  length: z.number().min(0).optional().nullable(),
  width:  z.number().min(0).optional().nullable(),
  height: z.number().min(0).optional().nullable(),
}).optional();

// ---------------------------------------------------------------------------
// 1. createVariantSchema — POST /api/v1/admin/products/:productId/variants
// ---------------------------------------------------------------------------
const createVariantSchema = z.object({
  // productId comes from the route param — ignored if sent in body
  productId: z.string().regex(/^[a-f\d]{24}$/i).optional(),

  size: z.string()
    .trim()
    .min(1, 'size is required')
    .refine((size) => !size.includes(','), 'Create one variant per size; comma-separated sizes are not allowed.'),
  color:  z.string().min(1, 'color is required'),
  fabric: z.string().min(1, 'fabric is required'),

  sku:     z.string().optional().nullable().transform(val => (val && val.trim() ? val.trim() : undefined)),
  barcode: z.string().optional().nullable(),


  price: z.number({ required_error: 'price is required', invalid_type_error: 'price must be a number' }).min(0, 'price must be >= 0'),
  stock: z.number({ invalid_type_error: 'stock must be a number' }).min(0).default(0).optional(),

  // Images use the same structure as product images
  images: z.array(imageObjectSchema).optional().default([]),

  // Per-variant shipping overrides (override product-level values for Shiprocket)
  weight:     z.number().min(0).optional().nullable(),   // grams
  dimensions: variantDimensionsSchema,
});

// ---------------------------------------------------------------------------
// 2. updateVariantSchema — PATCH /api/v1/admin/variants/:variantId
// ---------------------------------------------------------------------------
const updateVariantSchema = createVariantSchema.partial();

// ---------------------------------------------------------------------------
// Middleware factory — validateRequest(schema)
// ---------------------------------------------------------------------------
const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues ?? result.error.errors ?? [];
    const details = issues.map((e) => ({
      field:   e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed.', details },
    });
  }
  req.body = result.data;
  next();
};

const __exports: any = {
  createVariantSchema,
  updateVariantSchema,
  imageObjectSchema,
  validateRequest,
};

export default __exports;
