// @ts-nocheck — ported from the Express backend (routes/collectionRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/collectionController";
import __imp2 from "@/server/validators/collectionValidator";
import __imp3 from "@/server/middleware/authMiddleware";

const express = __imp0;
const collectionController = __imp1;
const {
  createCollectionSchema,
  updateCollectionSchema,
  validateRequest
} = __imp2;
const { authenticate, authorize } = __imp3;

// ─── Public router — no authentication required ───────────────────────────────
const publicRouter = express.Router();

// GET /api/v1/collections — list active collections (lightweight, for navigation/menus)
publicRouter.get('/', collectionController.listPublicCollections);

// GET /api/v1/collections/:slug — full collection with resolved products
publicRouter.get('/:slug', collectionController.getCollectionPublic);

// ─── Admin router — requires authenticate() + authorize("ADMIN") ──────────────
const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));

adminRouter.get('/',    collectionController.listCollections);
adminRouter.get('/:id', collectionController.getCollection);
adminRouter.post('/',   validateRequest(createCollectionSchema), collectionController.createCollection);
adminRouter.patch('/:id', validateRequest(updateCollectionSchema), collectionController.updateCollection);
adminRouter.delete('/:id', collectionController.deleteCollection);

const __exports: any = { publicRouter, adminRouter };

export default __exports;
