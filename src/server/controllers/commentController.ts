// @ts-nocheck — ported from the Express backend (controllers/commentController.js); logic unchanged.
import { verifyUpload } from "@/server/lib/storage";
import { REVIEW_FOLDER } from "@/server/modules/mediaLibrary/mediaUpload.routes";
import __imp0 from "@/server/models/commentModel";
import __imp1 from "@/server/models/productModel";
import __imp2 from "@/server/models/userModel";
import OrderModel from "@/server/models/orderModel";
import OrderItemModel from "@/server/models/orderItemModel";
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

const Order = OrderModel;
const OrderItem = OrderItemModel;

/** Orders that count as "received" for the Verified buyer badge. */
const RECEIVED_STATUSES = ['Delivered', 'ExchangeRequested', 'ExchangeApproved', 'ExchangeCompleted'];

/** Public name: first name + last initial ("Priya S."). Email is never shown. */
const publicName = (raw) => {
  const parts = String(raw || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Customer';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

const serializeComment = (c, verifiedUserIds = new Set()) => {
  const userId = c.userId?._id ? String(c.userId._id) : c.userId ? String(c.userId) : null;
  return {
    _id: c._id,
    body: c.body,
    rating: c.rating,
    user: userId || c.authorName ? { _id: userId, name: publicName(c.authorName || c.userId?.name) } : null,
    isGuest: !!c.isGuest,
    isVerifiedBuyer: !!userId && verifiedUserIds.has(userId),
    media: (c.media || []).map((m) => ({ url: m.url, type: m.type })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

/** Which of these users have received an order containing this product. */
const findVerifiedBuyers = async (productId, userIds) => {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return new Set();
  const orders = await Order.find({ userId: { $in: ids }, status: { $in: RECEIVED_STATUSES } }).select('_id userId').lean();
  if (!orders.length) return new Set();
  const items = await OrderItem.find({ productId: String(productId), orderId: { $in: orders.map((o) => String(o._id)) } })
    .select('orderId')
    .lean();
  const ownerByOrder = new Map(orders.map((o) => [String(o._id), String(o.userId)]));
  return new Set(items.map((i) => ownerByOrder.get(String(i.orderId))).filter(Boolean));
};

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

      // The signed-in reader's own review, whichever page it is on (for "Edit your review").
      const myRaw = req.user
        ? await Comment.findOne({ productId, userId: req.user.id, isDeleted: false }).populate('userId', 'name').lean()
        : null;
      const verified = await findVerifiedBuyers(productId, [
        ...comments.map((c) => c.userId?._id ?? c.userId),
        myRaw?.userId?._id ?? myRaw?.userId,
      ]);

      return sendSuccess(
        res,
        {
          comments: comments.map((c) => serializeComment(c, verified)),
          myComment: myRaw ? serializeComment(myRaw, verified) : null,
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
   * Signed-in customers only; the author is the account (no name/email in the request).
   * One review per customer per product: posting again updates it. Optional media.
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
      // A star rating is required.
      if (rating === null) {
        return sendValidationError(res, 'Please choose a star rating.');
      }
      {
        const r = Number(rating);
        if (!Number.isInteger(r) || r < 1 || r > 5) {
          return sendValidationError(res, 'Rating must be an integer between 1 and 5.');
        }
        rating = r;
      }

      // Verify product exists
      const product = await Product.findById(productId);
      if (!product || product.isDeleted) {
        return sendError(res, 'NOT_FOUND', 'Product not found.', 404);
      }

      // The author is always the signed-in account; its name comes from the profile.
      if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Please log in to write a review.', 401);
      const userId = req.user.id;
      const authorName = null;
      const isGuest = false;

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

      const verified = await findVerifiedBuyers(productId, [userId]);
      return sendSuccess(res, { comment: serializeComment(populated, verified) }, 201);
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
