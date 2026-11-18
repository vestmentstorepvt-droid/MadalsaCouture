// @ts-nocheck — ported from the Express backend (repositories/exchangeRepository.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/exchangeModel";

const mongoose = __imp0;
const Exchange = __imp1;

/**
 * Repository for Exchange CRUD and query operations.
 * All read-only queries use .lean() for performance.
 * Mutations use atomic findOneAndUpdate where applicable.
 */
class ExchangeRepository {
  /**
   * Insert a new exchange document.
   *
   * @param {Object} data - Exchange fields to persist.
   * @returns {Promise<Document>} The created Mongoose document.
   */
  async create(data) {
    return Exchange.create(data);
  }

  /**
   * Find an exchange by its ObjectId.
   * Validates the id before querying; returns null for invalid ids.
   *
   * @param {string|ObjectId} id - The exchange document ObjectId.
   * @returns {Promise<Object|null>} Lean exchange document or null.
   */
  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Exchange.findById(id)
      .populate('orderId', 'orderNumber')
      .populate('requestedBy', 'name email')
      .populate({
        path: 'orderItemId',
        populate: { path: 'productId', select: 'title' }
      })
      .lean();
  }

  /**
   * Find all exchanges belonging to a given order.
   * Validates the orderId before querying; returns [] for invalid ids.
   *
   * @param {string|ObjectId} orderId - The parent order's ObjectId.
   * @returns {Promise<Object[]>} Array of lean exchange documents (may be empty).
   */
  async findByOrderId(orderId) {
    if (!mongoose.Types.ObjectId.isValid(orderId)) return [];
    return Exchange.find({ orderId })
      .populate('orderId', 'orderNumber')
      .populate('requestedBy', 'name email')
      .populate({
        path: 'orderItemId',
        populate: { path: 'productId', select: 'title' }
      })
      .lean();
  }

  /**
   * Atomically update the exchange status and any additional fields.
   *
   * @param {string|ObjectId} exchangeId        - Exchange document ObjectId.
   * @param {string}          newStatus         - The new status value.
   * @param {Object}          [extraFields={}]  - Additional fields to $set
   *                                              alongside the status change
   *                                              (e.g. { reversePickupShipmentId }).
   * @returns {Promise<Object|null>} Updated lean document, or null if not found.
   */
  async updateStatus(exchangeId, newStatus, extraFields = {}, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(exchangeId)) return null;

    return Exchange.findOneAndUpdate(
      { _id: exchangeId },
      { $set: { status: newStatus, ...extraFields } },
      { new: true, runValidators: true, ...options }
    ).lean();
  }

  /**
   * Atomically record the admin's approval/rejection decision on an exchange.
   *
   * @param {string|ObjectId} exchangeId - Exchange document ObjectId.
   * @param {Object}          decision   - Decision payload.
   * @param {ObjectId}        decision.decidedBy  - Admin user ObjectId.
   * @param {Date}            decision.decidedAt  - Timestamp of the decision.
   * @param {string|null}     [decision.note]     - Optional explanatory note.
   * @returns {Promise<Object|null>} Updated lean document, or null if not found.
   */
  async setAdminDecision(exchangeId, decision) {
    if (!mongoose.Types.ObjectId.isValid(exchangeId)) return null;

    return Exchange.findOneAndUpdate(
      { _id: exchangeId },
      { $set: { adminDecision: decision } },
      { new: true, runValidators: true }
    ).lean();
  }

  /**
   * Atomically record the QC inspection result for the returned item.
   *
   * @param {string|ObjectId} exchangeId - Exchange document ObjectId.
   * @param {Object}          qcResult   - QC result payload.
   * @param {boolean}         qcResult.passed      - Whether the item passed QC.
   * @param {string|null}     [qcResult.note]      - Optional inspection note.
   * @param {ObjectId}        qcResult.recordedBy  - User who recorded the result.
   * @param {Date}            qcResult.recordedAt  - Timestamp of the QC check.
   * @returns {Promise<Object|null>} Updated lean document, or null if not found.
   */
  async setQcResult(exchangeId, qcResult) {
    if (!mongoose.Types.ObjectId.isValid(exchangeId)) return null;

    return Exchange.findOneAndUpdate(
      { _id: exchangeId },
      { $set: { qcResult } },
      { new: true, runValidators: true }
    ).lean();
  }
}

const __exports: any = new ExchangeRepository();

export default __exports;
