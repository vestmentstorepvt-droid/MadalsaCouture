// @ts-nocheck — ported from the Express backend (routes/checkoutRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/shiprocketCheckoutController";
import authMiddleware from "@/server/middleware/authMiddleware";
import { paymentLimiter } from "@/server/middleware/security";

const express = __imp0;
const { generateCheckoutToken, getCheckoutSession } = __imp1;

const router = express.Router();

/**
 * POST /api/checkout/token
 * Generate Shiprocket Checkout Access Token
 */
router.post('/token', paymentLimiter, authMiddleware.optionalAuthenticate, generateCheckoutToken);
router.get('/session/:id', getCheckoutSession);

const __exports: any = router;

export default __exports;
