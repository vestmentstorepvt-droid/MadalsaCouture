// @ts-nocheck — ported from the Express backend (modules/dashboard/dashboard.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/controllers/dashboardController";

const { Router } = __imp0;
const { authenticate, authorize } = __imp1;
const dashboardController = __imp2;

const router = Router();

// All dashboard / report routes require authentication and ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

// GET /api/v1/admin/dashboard
router.get('/dashboard', dashboardController.getDashboard.bind(dashboardController));

// GET /api/v1/admin/reports/sales
router.get('/reports/sales', dashboardController.getSalesReport.bind(dashboardController));

// GET /api/v1/admin/reports/inventory
router.get('/reports/inventory', dashboardController.getInventoryReport.bind(dashboardController));

// GET /api/v1/admin/reports/customers
router.get('/reports/customers', dashboardController.getCustomerReport.bind(dashboardController));

const __exports: any = router;

export default __exports;
