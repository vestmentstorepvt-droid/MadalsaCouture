// @ts-nocheck — ported from the Express backend (routes/checkoutRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/shiprocketCheckoutController";

const express = __imp0;
const { generateCheckoutToken } = __imp1;

const router = express.Router();

/**
 * POST /api/checkout/token
 * Generate Shiprocket Checkout Access Token
 */
router.post('/token', generateCheckoutToken);

const __exports: any = router;

export default __exports;
