// @ts-nocheck — ported from the Express backend (modules/cms/featuredSections/featuredSection.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/middleware/auditMiddleware";
import __imp3 from "@/server/modules/cms/featuredSections/featuredSectionController";

const express = __imp0;
const { authenticate, authorize } = __imp1;
const auditMiddleware = __imp2;
const { createSection, listSectionsAdmin, updateSection, deleteSection, listSectionsPublic } = __imp3;

const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));
adminRouter.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return auditMiddleware(req, res, next);
  next();
});
adminRouter.post('/', createSection);
adminRouter.get('/', listSectionsAdmin);
adminRouter.patch('/:id', updateSection);
adminRouter.put('/:id', updateSection);
adminRouter.delete('/:id', deleteSection);

const publicRouter = express.Router();
publicRouter.get('/', listSectionsPublic);

const __exports: any = { adminRouter, publicRouter };

export default __exports;
