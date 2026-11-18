// @ts-nocheck — ported from the Express backend (routes/addressRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/addressController";
import __imp2 from "@/server/middleware/authMiddleware";

const express = __imp0;
const addressController = __imp1;
const { authenticate } = __imp2;

const router = express.Router();

// All address routes require authentication
router.use(authenticate);

router.post('/', addressController.createAddress);
router.get('/', addressController.listAddresses);
router.patch('/:id', addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);
router.patch('/:id/default', addressController.setDefault);

const __exports: any = router;

export default __exports;
