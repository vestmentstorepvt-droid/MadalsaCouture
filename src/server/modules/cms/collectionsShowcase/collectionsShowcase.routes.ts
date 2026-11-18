// @ts-nocheck — ported from the Express backend (modules/cms/collectionsShowcase/collectionsShowcase.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/middleware/auditMiddleware";
import __imp3 from "@/server/modules/cms/collectionsShowcase/collectionsShowcaseController";

const express = __imp0;
const { authenticate, authorize } = __imp1;
const auditMiddleware = __imp2;
const { upsertShowcase, getShowcaseAdmin, getShowcasePublic } = __imp3;

const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));
adminRouter.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return auditMiddleware(req, res, next);
  next();
});
adminRouter.put('/', upsertShowcase);
adminRouter.get('/', getShowcaseAdmin);

const publicRouter = express.Router();
publicRouter.get('/', getShowcasePublic);

const __exports: any = { adminRouter, publicRouter };

export default __exports;
