// @ts-nocheck — ported from the Express backend (modules/notifications/notification.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/controllers/notificationController";

const { Router } = __imp0;
const { authenticate, authorize } = __imp1;
const notificationController = __imp2;

const router = Router();

// All notification management routes are admin-only
router.use(authenticate);
router.use(authorize('ADMIN'));

// GET  /api/v1/admin/notifications/templates
router.get('/templates', notificationController.listTemplates.bind(notificationController));

// PUT  /api/v1/admin/notifications/templates/:type
router.put('/templates/:type', notificationController.updateTemplate.bind(notificationController));

// GET  /api/v1/admin/notifications/logs
router.get('/logs', notificationController.listLogs.bind(notificationController));

const __exports: any = router;

export default __exports;
