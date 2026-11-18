// @ts-nocheck — ported from the Express backend (routes/categoryRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/categoryController";
import __imp2 from "@/server/validators/categoryValidator";
import __imp3 from "@/server/middleware/authMiddleware";

const express = __imp0;
const categoryController = __imp1;
const {
  createCategorySchema,
  updateCategorySchema,
  validateRequest
} = __imp2;
const { authenticate, authorize } = __imp3;

// ─── Public router — no authentication required ───────────────────────────────
const publicRouter = express.Router();

publicRouter.get('/tree', categoryController.getCategoryTree);
publicRouter.get('/:id', categoryController.getCategory);

// ─── Admin router — requires authenticate() + authorize("ADMIN") ──────────────
const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));

adminRouter.get('/', categoryController.listCategories);
adminRouter.get('/:id', categoryController.getCategory);
adminRouter.post('/', validateRequest(createCategorySchema), categoryController.createCategory);
adminRouter.patch('/:id', validateRequest(updateCategorySchema), categoryController.updateCategory);
adminRouter.patch('/:id/archive', categoryController.archiveCategory);
adminRouter.delete('/:id', categoryController.deleteCategory);

const __exports: any = { publicRouter, adminRouter };

export default __exports;
