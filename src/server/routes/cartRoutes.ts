// @ts-nocheck — ported from the Express backend (routes/cartRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/cartController";
import __imp2 from "@/server/middleware/authMiddleware";

const express = __imp0;
const cartController = __imp1;
const { authenticate } = __imp2;

const router = express.Router();

// All cart routes require authentication
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/items', cartController.addToCart);
router.patch('/items/:itemId', cartController.updateCartItem);
router.delete('/items/:itemId', cartController.removeCartItem);
router.delete('/', cartController.clearCart);
router.post('/sync', cartController.syncCart);

const __exports: any = router;

export default __exports;
