// @ts-nocheck — ported from the Express backend (modules/cms/banners/banner.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/middleware/auditMiddleware";
import __imp3 from "@/server/modules/cms/banners/bannerController";

const express = __imp0;
const { authenticate, authorize } = __imp1;
const auditMiddleware = __imp2;
const {
  createBanner,
  listBannersAdmin,
  updateBanner,
  deleteBanner,
  getBannersByPlacement
} = __imp3;

// ─────────────────────────────────────────────────────────────────────────────
// Admin Router
// Routes: /api/v1/admin/cms/banners
// All routes require authentication + ADMIN authorisation.
// Mutating routes (POST, PATCH, DELETE) also get audit logging.
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

// POST   /api/v1/admin/cms/banners        — create a new banner
adminRouter.post('/', createBanner);

// GET    /api/v1/admin/cms/banners        — list all banners (admin, paginated)
adminRouter.get('/', listBannersAdmin);

// PATCH  /api/v1/admin/cms/banners/:id   — update a banner
adminRouter.patch('/:id', updateBanner);

// DELETE /api/v1/admin/cms/banners/:id   — soft-delete a banner
adminRouter.delete('/:id', deleteBanner);

// ─────────────────────────────────────────────────────────────────────────────
// Public Router
// Routes: /api/v1/cms/banners
// No authentication required.
// ─────────────────────────────────────────────────────────────────────────────
const publicRouter = express.Router();

// GET /api/v1/cms/banners?placement=<name> — query-param style (used by the frontend)
publicRouter.get('/', (req, res, next) => {
  req.params.placement = req.query.placement || '';
  return getBannersByPlacement(req, res, next);
});

// GET /api/v1/cms/banners/:placement — path-param style (legacy / alternative)
publicRouter.get('/:placement', getBannersByPlacement);

const __exports: any = { adminRouter, publicRouter };

export default __exports;
