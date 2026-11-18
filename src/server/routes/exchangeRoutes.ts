// @ts-nocheck — ported from the Express backend (routes/exchangeRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/exchangeController";
import __imp2 from "@/server/middleware/authMiddleware";

const express = __imp0;
const exchangeController = __imp1;
const { authenticate, authorize } = __imp2;

// ─── Admin router — requires authenticate() + authorize('ADMIN') ──────────────
const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));

adminRouter.get('/', exchangeController.listExchanges);
adminRouter.get('/:id', exchangeController.getExchange);
adminRouter.patch('/:id/approve', exchangeController.approveExchange);
adminRouter.patch('/:id/reject', exchangeController.rejectExchange);
adminRouter.patch('/:id/qc', exchangeController.recordQcResult);

const __exports: any = { adminRouter };

export default __exports;
