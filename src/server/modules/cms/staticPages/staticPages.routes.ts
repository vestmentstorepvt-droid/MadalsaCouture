// @ts-nocheck — ported from the Express backend (modules/cms/staticPages/staticPages.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/middleware/auditMiddleware";
import __imp3 from "@/server/modules/cms/staticPages/staticPageController";

const express = __imp0;
const { authenticate, authorize } = __imp1;
const auditMiddleware = __imp2;
const { createPage, listPagesAdmin, updatePage, deletePage, getPageBySlug } = __imp3;

const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));
adminRouter.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return auditMiddleware(req, res, next);
  }
  next();
});

adminRouter.post('/', createPage);
adminRouter.get('/', listPagesAdmin);
adminRouter.patch('/:id', updatePage);
adminRouter.put('/:id', updatePage);
adminRouter.delete('/:id', deletePage);

const publicRouter = express.Router();
publicRouter.get('/:slug', getPageBySlug);

const __exports: any = { adminRouter, publicRouter };

export default __exports;
