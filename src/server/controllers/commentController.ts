// @ts-nocheck — ported from the Express backend (controllers/commentController.js); logic unchanged.
import { verifyUpload } from "@/server/lib/storage";
import { REVIEW_FOLDER } from "@/server/modules/mediaLibrary/mediaUpload.routes";
import __imp0 from "@/server/models/commentModel";
import __imp1 from "@/server/models/productModel";
import __imp2 from "@/server/models/userModel";
import __imp3 from "@/server/services/mediaService";
import __imp4 from "@/server/config/logger";
import __imp5 from "@/server/utils/response";
import __imp6 from "@/server/lib/mongoose";

const Comment = __imp0;
const Product = __imp1;
const User = __imp2;
const mediaService = __imp3;
const logger = __imp4;
const { sendSuccess, sendError, sendValidationError } = __imp5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const serializeComment = (c) => ({
  _id: c._id,
  body: c.body,
  rating: c.rating,
  user: c.userId
    ? { _id: c.userId._id, name: c.authorName || c.userId.name }
    : (c.authorName ? { _id: null, name: c.authorName } : null),
  isGuest: !!c.isGuest,
  media: (c.media || []).map((m) => ({ url: m.url, type: m.type })),
  createdAt: c.createdAt,
});

class CommentController {
  /**
   * GET /api/v1/products/:productId/comments
   * Public — list all comments for a product, newest first.
   * Supports pagination via ?page=1&limit=10
   */
  async listComments(req, res, next) {
    try {
      const { productId } = req.params;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const skip = (page - 1) * limit;

      const filter = { productId, isDeleted: false };

      const [comments, total] = await Promise.all([
        Comment.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'name email')
          .lean(),
        Comment.countDocuments(filter),
      ]);

      // Compute average rating + per-star distribution
      const matchStage = { $match: { productId: __imp6.Types.ObjectId.createFromHexString(productId), isDeleted: false, rating: { $ne: null } } };
      const [ratingAgg, distAgg] = await Promise.all([
        Comment.aggregate([matchStage, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
        Comment.aggregate([matchStage, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
      ]);
      const avgRating = ratingAgg.length > 0 ? Math.round(ratingAgg[0].avg * 10) / 10 : null;
      const ratingCount = ratingAgg.length > 0 ? ratingAgg[0].count : 0;
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      distAgg.forEach((d) => { if (distribution[d._id] !== undefined) distribution[d._id] = d.count; });

      return sendSuccess(
        res,
        {
          comments: comments.map(serializeComment),
          avgRating,
          ratingCount,
          distribution,
        },
        200,
        { pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/products/:productId/comments
   * Logged-in users OR guests (guest must send name + email; a user record is
   * created/reused for that email). Accepts optional multipart `media` files.
   */
  async createComment(req, res, next) {
    try {
      const { productId } = req.params;
      const { body } = req.body;
      let rating = req.body.rating;
      if (rating === '' || rating === 'null' || rating === undefined) rating = null;

      if (!body || typeof body !== 'string' || body.trim().length === 0) {
        return sendValidationError(res, 'Comment body is required.');
      }
      if (body.trim().length > 1000) {
        return sendValidationError(res, 'Comment must be 1000 characters or fewer.');
      }
      if (rating !== undefined && rating !== null) {
        const r = Number(rating);
        if (!Number.isInteger(r) || r < 1 || r > 5) {
          return sendValidationError(res, 'Rating must be an integer between 1 and 5.');
        }
      }

      // Verify product exists
      const product = await Product.findById(productId);
      if (!product || product.isDeleted) {
        return sendError(res, 'NOT_FOUND', 'Product not found.', 404);
      }

      // Resolve author: logged-in user, or guest (find-or-create by email)
      let userId;
      let authorName = null;
      let isGuest = false;
      if (req.user) {
        userId = req.user.id;
      } else {
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (name.length < 2) return sendValidationError(res, 'Please enter your name (min 2 characters).');
        if (!EMAIL_RE.test(email)) return sendValidationError(res, 'Please enter a valid email address.');

        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({ name, email, role: 'USER', authProvider: 'local' });
        } else if (user.status !== 'active' || user.isDeleted) {
          return sendError(res, 'FORBIDDEN', 'This account cannot post reviews.', 403);
        }
        userId = user._id;
        authorName = name;
        isGuest = true;
      }

      // Upload optional media
      const media = [];
      for (const file of req.files || []) {
        try {
          const { url, publicId } = await mediaService.uploadMedia(
            file, 'madalsa/reviews', ['review', String(productId)], userId
          );
          media.push({ url, publicId, type: file.mimetype.startsWith('video/') ? 'video' : 'image' });
        } catch (err) {
          logger.error('Review media upload failed:', err);
          return sendError(res, 'UPLOAD_FAILED', err.message || 'Media upload failed.', err.statusCode || 502);
        }
      }

      // Files the browser uploaded straight to storage (Vercel's 4.5 MB body limit):
      // `mediaUploads` = JSON [{ provider, publicId?, key?, resourceType }]. Each one is
      // verified with the storage provider and must sit in the reviews folder.
      if (req.body.mediaUploads) {
        let uploads = [];
        try {
          uploads = typeof req.body.mediaUploads === 'string' ? JSON.parse(req.body.mediaUploads) : req.body.mediaUploads;
        } catch {
          return sendValidationError(res, 'mediaUploads must be valid JSON.');
        }
        if (!Array.isArray(uploads) || uploads.length + media.length > 5) {
          return sendValidationError(res, 'You can attach at most 5 files.');
        }
        for (const u of uploads) {
          try {
            const file = await verifyUpload({
              provider: u.provider, publicId: u.publicId, key: u.key, resourceType: u.resourceType, folder: REVIEW_FOLDER,
            });
            if (file.resourceType !== 'image' && file.resourceType !== 'video') {
              return sendValidationError(res, 'Only image and video files are allowed.');
            }
            media.push({ url: file.url, publicId: file.publicId, type: file.resourceType });
          } catch (err) {
            return sendError(res, err.code || 'UPLOAD_FAILED', err.message || 'Media upload failed.', err.statusCode || 400);
          }
        }
      }

      const update = { body: body.trim(), rating: rating ?? null, authorName, isGuest, isDeleted: false };
      if (media.length > 0) update.media = media;

      // Upsert: one comment per user per product
      const comment = await Comment.findOneAndUpdate(
        { productId, userId },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const populated = await Comment.findById(comment._id)
        .populate('userId', 'name email')
        .lean();

      return sendSuccess(res, { comment: serializeComment(populated) }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/products/:productId/comments
   * Authenticated — soft-delete the user's own comment on a product.
   */
  async deleteComment(req, res, next) {
    try {
      const { productId } = req.params;
      const comment = await Comment.findOneAndUpdate(
        { productId, userId: req.user.id, isDeleted: false },
        { isDeleted: true },
        { new: true }
      );

      if (!comment) {
        return sendError(res, 'NOT_FOUND', 'Comment not found.', 404);
      }

      return sendSuccess(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new CommentController();

export default __exports;
