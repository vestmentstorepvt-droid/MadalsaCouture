// @ts-nocheck — ported from the Express backend (services/inventoryService.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/repositories/inventoryAuditLogRepository";
import __imp2 from "@/server/constants/reasonCodes";
import __imp3 from "@/server/constants/messages";

const mongoose = __imp0;
const inventoryAuditLogRepository = __imp1;
const { INVENTORY_REASON_CODES } = __imp2;
const { ERROR } = __imp3;

/**
 * Service for inventory stock management.
 *
 * Responsibilities:
 *   - Atomic stock adjustments with audit trail (adjustStock)
 *   - Low-stock variant reporting (getLowStockVariants)
 *   - Paginated inventory audit log retrieval (getInventoryLog)
 *
 * The Variant model is resolved lazily via mongoose.models.Variant to avoid
 * circular dependency issues at module load time.
 */
class InventoryService {
  /**
   * Atomically adjust the stock level of a variant and write an audit log entry.
   *
   * Business rules:
   *   1. `reasonCode` must be one of INVENTORY_REASON_CODES — throws 400 if invalid.
   *   2. `delta` must be a non-zero integer — throws 400 if invalid.
   *   3. For positive deltas: applies `$inc: { stock: delta }` unconditionally.
   *   4. For negative deltas: adds a guard `{ stock: { $gte: Math.abs(delta) } }` so
   *      stock can never drop below zero. If the guard fails (stock too low), throws 409.
   *   5. On success, writes an append-only audit log entry.
   *
   * @param {string|ObjectId} variantId  - ObjectId of the variant to adjust.
   * @param {number}          delta      - Signed integer; positive = add, negative = remove.
   * @param {string}          reasonCode - Must be a member of INVENTORY_REASON_CODES.
   * @param {string|null}     note       - Optional free-text note.
   * @param {{ id: ObjectId, email: string }} actor - Admin user from req.user.
   * @returns {Promise<Object>} Updated lean variant document.
   * @throws {Error} 400 — invalid reasonCode or non-integer / zero delta.
   * @throws {Error} 409 — stock would go negative (INSUFFICIENT_STOCK).
   */
  async adjustStock(variantId, delta, reasonCode, note, actor) {
    // Validate reasonCode
    if (!INVENTORY_REASON_CODES.includes(reasonCode)) {
      throw Object.assign(
        new Error(`Invalid reason code. Must be one of: ${INVENTORY_REASON_CODES.join(', ')}`),
        { statusCode: 400 }
      );
    }

    // Validate delta: must be a non-zero integer
    if (!Number.isInteger(delta) || delta === 0) {
      throw Object.assign(
        new Error('delta must be a non-zero integer.'),
        { statusCode: 400 }
      );
    }

    // Lazily resolve Variant model to avoid circular dependency issues
    const Variant = mongoose.models.Variant;

    // Build the filter and update
    const filter = { _id: variantId, isDeleted: false };

    // For negative deltas, guard against stock going below zero
    if (delta < 0) {
      filter.stock = { $gte: Math.abs(delta) };
    }

    const updated = await Variant.findOneAndUpdate(
      filter,
      { $inc: { stock: delta } },
      { new: true }
    ).lean();

    if (!updated) {
      // Either the variant doesn't exist or stock would go negative
      if (delta < 0) {
        throw Object.assign(
          new Error(ERROR.INSUFFICIENT_STOCK),
          { statusCode: 409 }
        );
      }
      // Variant not found (no negative-delta guard triggered)
      throw Object.assign(
        new Error(ERROR.NOT_FOUND),
        { statusCode: 404 }
      );
    }

    // Write audit log entry (append-only)
    await inventoryAuditLogRepository.create({
      variantId,
      delta,
      reasonCode,
      note: note || null,
      actorId: actor.id,
      actorEmail: actor.email,
      timestamp: new Date()
    });

    return updated;
  }

  /**
   * Find all non-deleted variants whose available stock is at or below the threshold.
   *
   * Available stock = stock - reservedStock. The comparison is evaluated inside
   * MongoDB using $expr + $subtract to avoid a round-trip.
   *
   * @param {number} threshold - Maximum available-stock level to include (inclusive).
   * @returns {Promise<Object[]>} Array of lean variant documents.
   */
  async getLowStockVariants(threshold) {
    const Variant = mongoose.models.Variant;

    return Variant.find({
      isDeleted: false,
      $expr: {
        $lte: [
          { $subtract: ['$stock', '$reservedStock'] },
          threshold
        ]
      }
    }).lean();
  }

  /**
   * Retrieve a paginated inventory audit log for a specific variant.
   *
   * Delegates query execution to the repository and wraps the result in the
   * standard `{ data, meta: { pagination } }` envelope.
   *
   * @param {string|ObjectId} variantId  - ObjectId of the variant.
   * @param {Object}          pagination - Pagination options `{ page, limit }`.
   * @returns {Promise<{ data: Object[], meta: { pagination: Object } }>}
   */
  async getInventoryLog(variantId, pagination = {}) {
    const { data, total } = await inventoryAuditLogRepository.findByVariant(
      variantId,
      pagination
    );

    const page  = Math.max(1, parseInt(pagination.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 20));

    return {
      data,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 1 : Math.ceil(total / limit)
        }
      }
    };
  }
}

const __exports: any = new InventoryService();

export default __exports;
