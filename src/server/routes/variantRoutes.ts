// @ts-nocheck — ported from the Express backend (routes/variantRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/variantController";
import __imp2 from "@/server/validators/variantValidator";
import __imp3 from "@/server/middleware/authMiddleware";

const express = __imp0;
const variantController = __imp1;
const { createVariantSchema, updateVariantSchema, validateRequest } = __imp2;
const { authenticate, authorize } = __imp3;

// ---------------------------------------------------------------------------
// Public router — GET /api/v1/products/:productId/variants (no auth)
// Mounted at /api/v1/products in app.js via publicVariantRouter
// ---------------------------------------------------------------------------
const publicVariantRouter = express.Router({ mergeParams: true });

// GET /api/v1/products/:productId/variants
publicVariantRouter.get('/:productId/variants', variantController.listPublicVariants.bind(variantController));

// ---------------------------------------------------------------------------
// Admin router — POST/GET /api/v1/admin/products/:productId/variants
// ---------------------------------------------------------------------------
const productVariantRouter = express.Router({ mergeParams: true });

productVariantRouter.use(authenticate);
productVariantRouter.use(authorize('ADMIN'));

productVariantRouter.post('/', validateRequest(createVariantSchema), variantController.createVariant.bind(variantController));
productVariantRouter.get('/', variantController.listVariants.bind(variantController));

// ---------------------------------------------------------------------------
// Admin router — GET/PATCH/DELETE /api/v1/admin/variants/:variantId
// ---------------------------------------------------------------------------
const variantRouter = express.Router();

variantRouter.use(authenticate);
variantRouter.use(authorize('ADMIN'));

variantRouter.get('/:variantId', variantController.getVariant.bind(variantController));
variantRouter.patch('/:variantId', validateRequest(updateVariantSchema), variantController.updateVariant.bind(variantController));
variantRouter.delete('/:variantId', variantController.deleteVariant.bind(variantController));

const __exports: any = { publicVariantRouter, productVariantRouter, variantRouter };

export default __exports;
