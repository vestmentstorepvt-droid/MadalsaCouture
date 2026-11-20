// @ts-nocheck — ported from the Express backend (routes/commentRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import { CUSTOMER_IMAGE_TYPES, CUSTOMER_VIDEO_TYPES } from "@/server/lib/storage";
import __imp1 from "@/server/lib/multer";
import __imp2 from "@/server/controllers/commentController";
import __imp3 from "@/server/middleware/authMiddleware";

const express = __imp0;
const multer = __imp1;
const commentController = __imp2;
const { authenticate, optionalAuthenticate } = __imp3;

const router = express.Router({ mergeParams: true }); // mergeParams to access :productId

// Multer — in-memory, images/videos only, max 5 files, 25 MB each
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (CUSTOMER_IMAGE_TYPES.test(file.mimetype) || CUSTOMER_VIDEO_TYPES.test(file.mimetype)) return cb(null, true); // no SVG/HTML
    cb(Object.assign(new Error('Only image and video files are allowed.'), { statusCode: 400 }));
  },
});

// Public — anyone can read reviews. A signed-in reader also gets their own review back (`myComment`).
router.get('/', optionalAuthenticate, commentController.listComments);

// Signed-in customers only. Guest reviews were removed: a guest could post as any existing
// customer by typing their email (and overwrite that customer's review).
router.post('/', authenticate, upload.array('media', 5), commentController.createComment);

// Authenticated — must be logged in to delete
router.delete('/', authenticate, commentController.deleteComment);

const __exports: any = router;

export default __exports;
