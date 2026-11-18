// @ts-nocheck — ported from the Express backend (routes/couponRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/couponController";
import __imp2 from "@/server/middleware/authMiddleware";
import __imp3 from "@/server/middleware/security";

const express = __imp0;
const couponController = __imp1;
const { authenticate, authorize } = __imp2;
const { couponLimiter } = __imp3;

// ─── Public router — coupon validation (no auth required) ────────────────────
const publicRouter = express.Router();

publicRouter.post('/validate', couponLimiter, couponController.validateCouponHandler);
publicRouter.get('/active', couponController.getActiveCoupons);
publicRouter.post('/claim-promo', couponController.claimPromoCoupon);


// ─── Admin router — requires authenticate() + authorize('ADMIN') ─────────────
const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));

adminRouter.post('/', couponController.createCoupon);
adminRouter.get('/', couponController.listCoupons);
adminRouter.patch('/:id', couponController.updateCoupon);
adminRouter.delete('/:id', couponController.deleteCoupon);

const __exports: any = { publicRouter, adminRouter };

export default __exports;
