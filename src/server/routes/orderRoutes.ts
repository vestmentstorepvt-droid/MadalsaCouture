// @ts-nocheck — ported from the Express backend (routes/orderRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/orderController";
import __imp2 from "@/server/services/exchangeService";
import __imp3 from "@/server/middleware/authMiddleware";
import { getSizeOptions, requestSizeChange } from "@/server/services/orderSizeChangeService";

const express = __imp0;
const orderController = __imp1;
const exchangeService = __imp2;
const { authenticate, authorize } = __imp3;

// ─── Customer router — requires authentication ────────────────────────────────
const customerRouter = express.Router();

customerRouter.use(authenticate);

customerRouter.get('/', orderController.listMyOrders);
customerRouter.get('/:id', orderController.getMyOrder);
customerRouter.post('/:id/cancel', orderController.cancelMyOrder);
customerRouter.get('/:id/size-options', async (req, res, next) => {
  try {
    return res.json({ success: true, data: await getSizeOptions(req.params.id, req.user.id) });
  } catch (err) {
    next(err);
  }
});
customerRouter.post('/:id/size-change', async (req, res, next) => {
  try {
    const order = await requestSizeChange(req.params.id, req.user.id, req.body || {});
    return res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
});

customerRouter.post('/:orderId/items/:itemId/exchange-request', async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason, requestedVariantId } = req.body;
    const exchange = await exchangeService.requestExchange(orderId, itemId, req.user.id, reason, requestedVariantId);
    return res.status(201).json({ data: { exchange } });
  } catch (err) {
    next(err);
  }
});

// ─── Admin router — requires authenticate() + authorize('ADMIN') ──────────────
const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));

adminRouter.get('/', orderController.listOrders);
adminRouter.get('/:id', orderController.getOrder);
adminRouter.patch('/:id/status', orderController.updateOrderStatus);

const __exports: any = { customerRouter, adminRouter };

export default __exports;
