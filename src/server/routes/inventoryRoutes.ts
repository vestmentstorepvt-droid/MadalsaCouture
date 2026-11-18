// @ts-nocheck — ported from the Express backend (routes/inventoryRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/inventoryController";
import __imp2 from "@/server/validators/inventoryValidator";
import __imp3 from "@/server/middleware/authMiddleware";

const express = __imp0;
const inventoryController = __imp1;
const { adjustStockSchema, validateRequest } = __imp2;
const { authenticate, authorize } = __imp3;

const inventoryRouter = express.Router();

// All inventory routes are admin-only
inventoryRouter.use(authenticate);
inventoryRouter.use(authorize('ADMIN'));

// PATCH /api/v1/admin/inventory/:variantId/adjust
inventoryRouter.patch('/:variantId/adjust', validateRequest(adjustStockSchema), inventoryController.adjustStock);

// GET /api/v1/admin/inventory  (low-stock list)
inventoryRouter.get('/', inventoryController.getInventory);

// GET /api/v1/admin/inventory/:variantId/log
inventoryRouter.get('/:variantId/log', inventoryController.getInventoryLog);

const __exports: any = inventoryRouter;

export default __exports;
