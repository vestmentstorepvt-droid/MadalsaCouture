// @ts-nocheck — ported from the Express backend (routes/wishlistRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/wishlistController";
import __imp2 from "@/server/middleware/authMiddleware";

const express = __imp0;
const wishlistController = __imp1;
const { authenticate } = __imp2;

const router = express.Router();

// All wishlist routes require authentication
router.use(authenticate);

router.post('/:productId', wishlistController.addToWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);
router.get('/', wishlistController.getWishlist);

const __exports: any = router;

export default __exports;
