// @ts-nocheck — ported from the Express backend (validators/productValidator.js); logic unchanged.
import * as __imp0 from "zod";

const { z } = __imp0;

// ---------------------------------------------------------------------------
// Reusable helpers
// ---------------------------------------------------------------------------

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid MongoDB ObjectId');

const objectIdArray = z.array(objectId).optional();

const attributeSchema = z.object({
  label: z.string(),
  value: z.string(),
});

// ---------------------------------------------------------------------------
// Sub-object schemas
// ---------------------------------------------------------------------------

const specificationsSchema = z
  .object({
    fabric: z.string().optional().nullable(),
    careInstructions: z.string().optional().nullable(),
    fitNotes: z.string().optional().nullable(),
    measurements: z.string().optional().nullable(),
    washCare: z.string().optional().nullable(),
    countryOfOrigin: z.string().optional().default('India'),
  })
  .optional();

const dimensionsSchema = z
  .object({
    length: z.number().optional().nullable(),
    width: z.number().optional().nullable(),
    height: z.number().optional().nullable(),
  })
  .optional();

const shippingSchema = z
  .object({
    weight: z.number().optional().nullable(),
    dimensions: dimensionsSchema,
    shippingClass: z.string().optional().nullable(),
  })
  .optional();

const seoSchema = z
  .object({
    metaTitle: z.string().optional().nullable(),
    metaDescription: z.string().optional().nullable(),
    metaKeywords: z.array(z.string()).optional().default([]),
    canonicalUrl: z.string().optional().nullable(),
    ogImage: z.string().optional().nullable(),
  })
  .optional();

const imageObjectSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  altText: z.string().optional().default(''),
  role: z.enum([
    'primary',
    'gallery',
    'hover',
    'sizeChart',
    'lifestyle',
    'back',
    'side',
    'closeup',
    'video',
    '360',
  ]).optional().default('gallery'),
  sortOrder: z.number().optional().default(0),
});

const flagsSchema = z
  .object({
    isNewArrival: z.boolean().optional().default(false),
    isFeatured: z.boolean().optional().default(false),
    isBestSeller: z.boolean().optional().default(false),
    isTrending: z.boolean().optional().default(false),
    isLimitedEdition: z.boolean().optional().default(false),
    isMadeToOrder: z.boolean().optional().default(false),
    isReadyToShip: z.boolean().optional().default(true),
    isPreOrder: z.boolean().optional().default(false),
  })
  .optional();

// ---------------------------------------------------------------------------
// 1. createProductSchema — POST /api/v1/admin/products
// ---------------------------------------------------------------------------

const createProductSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  shortDescription: z.string().max(300, 'Short description must be <= 300 characters').optional().nullable(),
  description: z.string().optional().nullable(),
  basePrice: z.number({ required_error: 'basePrice is required' }).min(0, 'basePrice must be >= 0'),
  mrp: z.number().min(0, 'MRP must be >= 0').optional().nullable(),
  sku: z.string().optional().nullable(),
  taxRate: z.number().min(0, 'Tax rate must be >= 0').optional().default(0),
  hsnCode: z.string().optional().nullable(),
  categoryId: objectId.optional().nullable(),
  subcategoryId: objectId.optional().nullable(),
  collectionIds: objectIdArray,
  tagIds: objectIdArray,
  designer: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  occasions: z.array(z.string()).optional().default([]),
  season: z.string().optional().nullable(),
  gender: z.enum(['Women', 'Men', 'Girls', 'Boys', 'Unisex']).optional().default('Unisex'),
  ageGroup: z.enum(['Adult', 'Teen', 'Kids']).optional().default('Adult'),
  flags: flagsSchema,
  isCODEligible: z.boolean().optional().default(true),
  isCouponEligible: z.boolean().optional().default(true),
  images: z.array(imageObjectSchema).optional().default([]),
  highlights: z.array(z.string()).optional().default([]),
  productDetails: z.array(attributeSchema).optional().default([]),
  sizeFit: z.array(attributeSchema).optional().default([]),
  stylingTips: z.array(z.string()).optional().default([]),
  careInstructions: z.array(z.string()).optional().default([]),
  deliveryReturns: z.array(z.string()).optional().default([]),
  disclaimer: z.string().optional().nullable(),
  specifications: specificationsSchema,
  shipping: shippingSchema,
  seo: seoSchema,
  relatedProductIds: objectIdArray,
  crossSellIds: objectIdArray,
  upSellIds: objectIdArray,

  // Per-product exchange window in days (null = use global DEFAULT_EXCHANGE_WINDOW_DAYS)
  exchangeWindowDays: z.number().min(0).optional().nullable(),
});

// ---------------------------------------------------------------------------
// 2. updateProductSchema — PATCH /api/v1/admin/products/:id
// ---------------------------------------------------------------------------

const updateProductSchema = createProductSchema.partial();

// ---------------------------------------------------------------------------
// 3. updateStatusSchema — PATCH /api/v1/admin/products/:id/status
// ---------------------------------------------------------------------------

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived'], {
    required_error: 'status is required',
    invalid_type_error: "status must be one of 'draft', 'published', or 'archived'",
  }),
});

// ---------------------------------------------------------------------------
// Middleware factory — validateRequest(schema)
// ---------------------------------------------------------------------------

const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues ?? result.error.errors ?? [];
    const details = issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        details,
      },
    });
  }
  req.body = result.data; // use parsed/sanitised data
  next();
};

const __exports: any = {
  createProductSchema,
  updateProductSchema,
  updateStatusSchema,
  validateRequest,
};

export default __exports;
