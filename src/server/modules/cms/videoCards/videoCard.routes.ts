// @ts-nocheck — ported from the Express backend (modules/cms/videoCards/videoCard.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/middleware/auditMiddleware";
import __imp3 from "@/server/modules/cms/videoCards/videoCardController";

const express = __imp0;
const { authenticate, authorize } = __imp1;
const auditMiddleware = __imp2;
const controller = __imp3;

const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));
adminRouter.use((req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return auditMiddleware(req, res, next);
  }
  return next();
});
adminRouter.get('/', controller.listAdmin);
adminRouter.post('/', controller.create);
adminRouter.patch('/:id', controller.update);
adminRouter.put('/:id', controller.update);
adminRouter.delete('/:id', controller.remove);

const publicRouter = express.Router();
publicRouter.get('/', controller.listPublic);

const __exports: any = { adminRouter, publicRouter };

export default __exports;
