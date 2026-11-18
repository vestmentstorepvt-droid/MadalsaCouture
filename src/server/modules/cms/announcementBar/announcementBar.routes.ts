// @ts-nocheck — ported from the Express backend (modules/cms/announcementBar/announcementBar.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/middleware/auditMiddleware";
import __imp3 from "@/server/modules/cms/announcementBar/announcementBarController";

const express = __imp0;
const { authenticate, authorize } = __imp1;
const auditMiddleware = __imp2;
const {
  upsertAnnouncementBar,
  getAnnouncementBarAdmin,
  getAnnouncementBarPublic
} = __imp3;

// ─────────────────────────────────────────────────────────────────────────────
// Admin Router
// Routes: /api/v1/admin/cms/announcement-bar
// All routes require authentication + ADMIN authorisation.
// Mutating routes (PUT) also get audit logging.
// ─────────────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));

// Apply audit middleware to every mutating request
adminRouter.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return auditMiddleware(req, res, next);
  }
  next();
});

// PUT  /api/v1/admin/cms/announcement-bar — upsert the singleton
adminRouter.put('/', upsertAnnouncementBar);

// GET  /api/v1/admin/cms/announcement-bar — retrieve for admin (no filters)
adminRouter.get('/', getAnnouncementBarAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// Public Router
// Routes: /api/v1/cms/announcement-bar
// No authentication required.
// ─────────────────────────────────────────────────────────────────────────────
const publicRouter = express.Router();

// GET /api/v1/cms/announcement-bar — schedule-filtered, active-only
publicRouter.get('/', getAnnouncementBarPublic);

const __exports: any = { adminRouter, publicRouter };

export default __exports;
