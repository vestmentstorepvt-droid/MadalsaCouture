// @ts-nocheck — ported from the Express backend (repositories/inventoryAuditLogRepository.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/inventoryAuditLogModel";

const mongoose = __imp0;
const InventoryAuditLog = __imp1;

/**
 * Repository for InventoryAuditLog operations.
 *
 * This is an append-only log — no update or delete methods are provided
 * by design. All read queries use .lean() for performance.
 */
class InventoryAuditLogRepository {
  /**
   * Insert a new audit log entry.
   * @param {Object} data - Log fields to persist (variantId, delta, reasonCode, actorId, etc.).
   * @returns {Promise<Document>} The created Mongoose document.
   */
  async create(data) {
    return InventoryAuditLog.create(data);
  }

  /**
   * Paginated list of audit log entries for a specific variant, newest first.
   *
   * @param {string|ObjectId} variantId  - The variant whose log entries to fetch.
   * @param {Object}          pagination - Pagination options.
   * @param {number}          [pagination.page=1]  - 1-based page number.
   * @param {number}          [pagination.limit=20] - Documents per page (max 100).
   * @returns {Promise<{ data: Object[], total: number }>}
   *          Lean log documents for the requested page and total count.
   */
  async findByVariant(variantId, pagination = {}) {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return { data: [], total: 0 };
    }

    const { page = 1, limit = 20 } = pagination;

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const safePage  = Math.max(parseInt(page, 10) || 1, 1);
    const skip      = (safePage - 1) * safeLimit;

    const query = { variantId: new mongoose.Types.ObjectId(variantId) };

    const [data, total] = await Promise.all([
      InventoryAuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      InventoryAuditLog.countDocuments(query)
    ]);

    return { data, total };
  }
}

const __exports: any = new InventoryAuditLogRepository();

export default __exports;
