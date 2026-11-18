// @ts-nocheck — ported from the Express backend (repositories/couponRepository.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/couponModel";

const mongoose = __imp0;
const Coupon = __imp1;

/**
 * Repository for Coupon CRUD and query operations.
 * All read-only queries use .lean() for performance.
 * Soft-deleted documents (isDeleted: true) are excluded from standard reads.
 */
class CouponRepository {
  /**
   * Insert a new coupon document.
   * @param {Object} data - Coupon fields to persist.
   * @returns {Promise<Document>} The created Mongoose document.
   */
  async create(data) {
    return Coupon.create(data);
  }

  /**
   * Find a single coupon by its ObjectId, excluding soft-deleted records.
   * @param {string|ObjectId} id - Coupon ObjectId.
   * @returns {Promise<Object|null>} Lean coupon document or null.
   */
  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Coupon.findOne({ _id: id, isDeleted: false }).lean();
  }

  /**
   * Find a coupon by its code (case-insensitive lookup — model stores uppercase).
   * @param {string} code - Coupon code.
   * @returns {Promise<Object|null>} Lean coupon document or null.
   */
  async findByCode(code) {
    return Coupon.findOne({ code: code.toUpperCase(), isDeleted: false }).lean();
  }

  /**
   * List coupons with optional filtering and pagination.
   *
   * Supported filters:
   *   type      {string}  – 'percentage' | 'flat' | 'free_shipping'
   *   isDeleted {boolean} – defaults to false
   *   search    {string}  – case-insensitive partial match on code
   *
   * Supported pagination options:
   *   page  {number} – 1-based page number (default: 1)
   *   limit {number} – documents per page (default: 20, max: 100)
   *   sort  {Object} – Mongoose sort spec (default: { createdAt: -1 })
   *
   * @param {Object} filters    – Filter criteria.
   * @param {number} [page=1]   – Page number (positional arg for compatibility).
   * @param {number} [limit=20] – Page size (positional arg for compatibility).
   * @returns {Promise<{ data: Object[], total: number }>}
   */
  async findAll(filters = {}, page = 1, limit = 20) {
    const { type, isDeleted = false, search, sort = { createdAt: -1 } } = filters;

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const safePage  = Math.max(parseInt(page, 10) || 1, 1);
    const skip      = (safePage - 1) * safeLimit;

    const query = { isDeleted: Boolean(isDeleted) };

    if (type) query.type = type;

    if (search) {
      query.code = { $regex: search, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      Coupon.find(query).sort(sort).skip(skip).limit(safeLimit).lean(),
      Coupon.countDocuments(query)
    ]);

    return { data, total };
  }

  /**
   * Update a coupon by ObjectId.
   * @param {string|ObjectId} id   - Coupon ObjectId.
   * @param {Object}          data - Fields to update.
   * @returns {Promise<Object|null>} Updated lean document or null if not found.
   */
  async update(id, data) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    return Coupon.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    ).lean();
  }

  /**
   * Soft-delete a coupon by setting isDeleted + deletedAt.
   * @param {string|ObjectId} id      - Coupon ObjectId.
   * @param {string|ObjectId} adminId - Admin user performing the delete.
   * @returns {Promise<Object|null>} Updated lean document or null if not found.
   */
  async softDelete(id, adminId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    return Coupon.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: adminId } },
      { new: true }
    ).lean();
  }

  /**
   * Atomically increment usageCount, but only when the current count is below
   * the total usage limit (or when there is no limit).
   *
   * Uses a conditional findOneAndUpdate so that two concurrent requests cannot
   * both succeed when only one slot remains.
   *
   * @param {string} code              - Coupon code.
   * @param {number|null} usageLimitTotal - Maximum allowed uses (null = unlimited).
   * @returns {Promise<Object|null>} Updated lean document, or null if the limit
   *                                 was already reached.
   */
  async atomicIncrementUsage(code, usageLimitTotal, options = {}) {
    const condition = {
      code: code.toUpperCase(),
      isDeleted: false
    };

    // Add the usage-limit guard only when a limit is set
    if (usageLimitTotal != null) {
      condition.$expr = { $lt: ['$usageCount', usageLimitTotal] };
    }

    return Coupon.findOneAndUpdate(
      condition,
      { $inc: { usageCount: 1 } },
      { new: true, session: options.session || null }
    ).lean();
  }

  /**
   * Compensating action for `atomicIncrementUsage` — releases a reserved
   * usage slot (order cancelled/failed before the coupon was actually
   * consumed). Clamped at 0 via an aggregation-pipeline update so retries
   * or double-release attempts are safe no-ops rather than errors, matching
   * `variantRepository.atomicRelease`'s idempotent-compensation contract.
   *
   * @param {string} code
   * @returns {Promise<Object|null>} Updated lean document, or null if the
   *          coupon no longer exists (already deleted — safe to ignore).
   */
  async atomicReleaseUsage(code, options = {}) {
    return Coupon.findOneAndUpdate(
      { code: code.toUpperCase() },
      [
        {
          $set: {
            usageCount: { $max: [{ $subtract: ['$usageCount', 1] }, 0] }
          }
        }
      ],
      { new: true, session: options.session || null }
    ).lean();
  }
}

const __exports: any = new CouponRepository();

export default __exports;
