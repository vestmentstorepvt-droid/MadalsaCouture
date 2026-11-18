// @ts-nocheck — ported from the Express backend (modules/cms/hero/hero.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/middleware/auditMiddleware";
import __imp3 from "@/server/modules/cms/hero/heroController";

const express = __imp0;
const { authenticate, authorize } = __imp1;
const auditMiddleware = __imp2;
const { upsertHero, getHeroAdmin, getHeroPublic } = __imp3;

// ─────────────────────────────────────────────────────────────────────────────
// Admin Router
// Routes: /api/v1/admin/cms/hero
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

// PUT  /api/v1/admin/cms/hero — upsert the singleton hero
adminRouter.put('/', upsertHero);

// GET  /api/v1/admin/cms/hero — retrieve hero for admin (no filters)
adminRouter.get('/', getHeroAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// Public Router
// Routes: /api/v1/cms/hero
// No authentication required.
// ─────────────────────────────────────────────────────────────────────────────
const publicRouter = express.Router();

// GET /api/v1/cms/hero — schedule-filtered, active-only hero
publicRouter.get('/', getHeroPublic);

const __exports: any = { adminRouter, publicRouter };

export default __exports;
