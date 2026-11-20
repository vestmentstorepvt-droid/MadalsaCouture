// @ts-nocheck — ported from the Express backend (routes/productRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/productController";
import __imp2 from "@/server/validators/productValidator";
import __imp3 from "@/server/middleware/authMiddleware";

const express = __imp0;
const productController = __imp1;
const {
  createProductSchema,
  updateProductSchema,
  updateStatusSchema,
  validateRequest
} = __imp2;
const { authenticate, authorize } = __imp3;

// ─── Public router — no authentication required ──────────────────────────────
const publicRouter = express.Router();

publicRouter.get('/', productController.listProducts);
publicRouter.get('/facets', productController.getProductFacets); // before /:slug
publicRouter.get('/:slug', productController.getProduct);

// ─── Admin router — requires authenticate() + authorize("ADMIN") ─────────────
const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));

adminRouter.get('/', productController.adminListProducts);
adminRouter.get('/:id', productController.adminGetProduct);
adminRouter.post('/', validateRequest(createProductSchema), productController.createProduct);
adminRouter.patch('/:id', validateRequest(updateProductSchema), productController.updateProduct);
adminRouter.patch('/:id/status', validateRequest(updateStatusSchema), productController.updateProductStatus);
adminRouter.delete('/:id', productController.deleteProduct);

const __exports: any = { publicRouter, adminRouter };

export default __exports;
