// @ts-nocheck — ported from the Express backend (routes/tagRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/tagController";
import __imp2 from "@/server/validators/tagValidator";
import __imp3 from "@/server/middleware/authMiddleware";

const express = __imp0;
const tagController = __imp1;
const { createTagSchema, validateRequest } = __imp2;
const { authenticate, authorize } = __imp3;

// ─── Public router — no authentication required ───────────────────────────────
const publicRouter = express.Router();

publicRouter.get('/', tagController.listTags);

// ─── Admin router — requires authenticate() + authorize("ADMIN") ──────────────
const adminRouter = express.Router();

adminRouter.use(authenticate);
adminRouter.use(authorize('ADMIN'));

adminRouter.get('/', tagController.adminListTags);
adminRouter.post('/', validateRequest(createTagSchema), tagController.createTag);
adminRouter.delete('/:id', tagController.deleteTag);

const __exports: any = { publicRouter, adminRouter };

export default __exports;
