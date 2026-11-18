// @ts-nocheck — ported from the Express backend (routes/adminNotificationRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/adminNotificationController";
import __imp2 from "@/server/middleware/authMiddleware";

const express = __imp0;
const adminNotificationController = __imp1;
const { authenticate, authorize } = __imp2;

const router = express.Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', adminNotificationController.getNotifications);
router.patch('/read-all', adminNotificationController.markAllAsRead);
router.patch('/:id/read', adminNotificationController.markAsRead);

const __exports: any = router;

export default __exports;
