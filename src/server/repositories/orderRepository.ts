// @ts-nocheck — ported from the Express backend (repositories/orderRepository.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/orderModel";
import __imp2 from "@/server/utils/pagination";

const mongoose = __imp0;
const Order = __imp1;
const { paginate } = __imp2;

/**
 * Repository for Order CRUD and query operations.
 * All read-only queries use .lean() for performance.
 * Soft-deleted documents (isDeleted: true) are excluded from standard reads.
 */
class OrderRepository {
  /**
   * Insert a new order document.
   * @param {Object} data - Order fields to persist.
   * @returns {Promise<Document>} The created Mongoose document.
   */
  async create(data, options = {}) {
    if (options.session) {
      const [order] = await Order.create([data], { session: options.session });
      return order;
    }
    return Order.create(data);
  }

  /**
   * Find a single order by its ObjectId, excluding soft-deleted records.
   *
   * @param {string|ObjectId} id      - Order ObjectId.
   * @param {Object}          options - Optional query modifiers.
   * @param {boolean}         [options.populate=false] - Populate `items` (OrderItem docs).
   * @returns {Promise<Object|null>} Lean order document or null.
   */
  async findById(id, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    let query = Order.findOne({ _id: id, isDeleted: false });

    if (options.populate) {
      query = query.populate('items');
    }

    return query.lean();
  }

  /**
   * Find all non-deleted orders for a given user, sorted newest-first.
   * Supports pagination and always populates `items` by default.
   *
   * @param {string|ObjectId} userId  - User ObjectId.
   * @param {Object}          options - Pagination and population options.
   * @param {number}          [options.page=1]     - 1-based page number.
   * @param {number}          [options.limit=20]   - Documents per page (max 100).
   * @param {boolean}         [options.populate=true] - Populate `items` array.
   * @returns {Promise<{ data: Object[], meta: { pagination: Object } }>}
   */
  async findByUser(userId, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { data: [], meta: { pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } };
    }

    const { page = 1, limit = 20, populate = true } = options;

    const paginateOptions = {
      page,
      limit,
      sort: { createdAt: -1 }
    };

    if (populate) {
      paginateOptions.populate = 'items';
    }

    return paginate(Order, { userId, isDeleted: false }, paginateOptions);
  }

  /**
   * Admin query: list orders with optional filters and pagination.
   *
   * Supported filters:
   *   status        {string} – filter by specific order status string
   *   userId        {ObjectId} – filter by customer
   *   orderNumber   {string} – partial case-insensitive match (regex)
   *   dateFrom      {Date|string} – lower bound on createdAt (inclusive)
   *   dateTo        {Date|string} – upper bound on createdAt (inclusive)
   *   paymentMethod {string} – 'online' | 'cod'
   *
   * Always excludes soft-deleted orders. Sorted by createdAt desc.
   *
   * @param {Object} filters  – Filter criteria as described above.
   * @param {number} [page=1]   – 1-based page number.
   * @param {number} [limit=20] – Documents per page (max 100).
   * @returns {Promise<{ data: Object[], meta: { pagination: Object } }>}
   */
  async findAll(filters = {}, page = 1, limit = 20) {
    const { status, userId, orderNumber, dateFrom, dateTo, paymentMethod } = filters;

    const query = { isDeleted: false };

    if (status) {
      query.status = status;
    }

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return { data: [], meta: { pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } };
      }
      query.userId = userId;
    }

    if (orderNumber) {
      query.orderNumber = { $regex: orderNumber, $options: 'i' };
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo)   query.createdAt.$lte = new Date(dateTo);
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    return paginate(Order, query, { page, limit, sort: { createdAt: -1 } });
  }

  /**
   * Atomically update an order's status and append a history entry.
   *
   * Uses a single findOneAndUpdate with $set + $push so no intermediate
   * state is visible to concurrent readers.
   *
   * When `expectedCurrentStatus` is supplied, the write is a compare-and-swap:
   * it only succeeds if the order's status in the database still matches
   * what the caller last read. This prevents lost updates when two
   * transitions race for the same order (e.g. an admin manually changing
   * status at the same moment a webhook fires) — the loser gets `null` back
   * instead of silently clobbering the winner's write.
   *
   * @param {string|ObjectId} orderId               - Order ObjectId.
   * @param {string}          newStatus              - New status value (must be in ORDER_STATES).
   * @param {Object}          historyEntry            - Status history entry to append.
   * @param {Object}          [options]
   * @param {string}          [options.expectedCurrentStatus] - CAS guard; omit to skip the check.
   * @param {ClientSession}   [options.session]        - Mongo session for transactional writes.
   * @returns {Promise<Object|null>} Updated lean document, or null if not found
   *          / the CAS guard failed (status changed concurrently).
   */
  async updateStatus(orderId, newStatus, historyEntry, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(orderId)) return null;

    const filter = { _id: orderId, isDeleted: false };
    if (options.expectedCurrentStatus) {
      filter.status = options.expectedCurrentStatus;
    }

    return Order.findOneAndUpdate(
      filter,
      {
        $set: { status: newStatus },
        $push: { statusHistory: historyEntry }
      },
      { new: true, runValidators: true, session: options.session || null }
    ).lean();
  }

  /**
   * Find all non-deleted orders matching a specific status.
   *
   * @param {string} status - Order status to filter by.
   * @returns {Promise<Object[]>} Array of lean order documents.
   */
  async findByStatus(status) {
    return Order.find({ status, isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();
  }
}

const __exports: any = new OrderRepository();

export default __exports;
