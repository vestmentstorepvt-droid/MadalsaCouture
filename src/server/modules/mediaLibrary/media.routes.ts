// @ts-nocheck — ported from the Express backend (modules/mediaLibrary/media.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/lib/multer";
import __imp2 from "@/server/middleware/authMiddleware";
import __imp3 from "@/server/middleware/auditMiddleware";
import __imp4 from "@/server/controllers/mediaController";

const express = __imp0;
const multer = __imp1;
const { authenticate, authorize } = __imp2;
const auditMiddleware = __imp3;
const mediaController = __imp4;

// ---------------------------------------------------------------------------
// Multer — in-memory storage, 100 MB limit, no mimetype filter
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  // 100 MB cap — supports video uploads (MP4, WebM, MOV) while keeping
  // oversized files from being buffered into memory before rejection.
  limits: { fileSize: 100 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const router = express.Router();

// All routes require authentication and ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

// POST / — upload a single file
router.post(
  '/',
  auditMiddleware,
  upload.single('file'),
  mediaController.uploadMedia.bind(mediaController)
);

// GET / — list media assets
router.get('/', mediaController.listMedia.bind(mediaController));

// DELETE /* — wildcard to support Cloudinary public IDs that contain slashes
// e.g. DELETE /folder/filename  →  req.params[0] === 'folder/filename'
// router.delete(
//   '/*',
//   auditMiddleware,
//   mediaController.deleteMedia.bind(mediaController)
// );

// DELETE /:publicId (supports nested Cloudinary public IDs)
router.delete(
  '/*publicId',
  auditMiddleware,
  mediaController.deleteMedia.bind(mediaController)
);

const __exports: any = router;

export default __exports;
