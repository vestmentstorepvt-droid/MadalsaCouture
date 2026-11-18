// @ts-nocheck — ported from the Express backend (modules/cms/contact/contact.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/middleware/authMiddleware";
import __imp2 from "@/server/middleware/auditMiddleware";
import __imp3 from "@/server/modules/cms/contact/contactController";

const express = __imp0;
const { authenticate, authorize } = __imp1;
const auditMiddleware = __imp2;
const { upsertContact, getContactAdmin, getContactPublic, submitInquiry, getInquiriesAdmin } = __imp3;

const adminRouter = express.Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));
adminRouter.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return auditMiddleware(req, res, next);
  next();
});
adminRouter.put('/', upsertContact);
adminRouter.get('/', getContactAdmin);
adminRouter.get('/inquiries', getInquiriesAdmin);

const publicRouter = express.Router();
publicRouter.get('/', getContactPublic);
publicRouter.post('/inquiry', submitInquiry);

const __exports: any = { adminRouter, publicRouter };

export default __exports;
