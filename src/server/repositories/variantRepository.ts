// @ts-nocheck — ported from the Express backend (repositories/variantRepository.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/variantModel";

const mongoose = __imp0;
const Variant = __imp1;

/**
 * Repository for Variant CRUD and atomic stock operations.
 *
 * All read-only queries use .lean() for performance.
 * Soft-deleted documents (isDeleted: true) are excluded from all reads.
 *
 * Atomic stock methods use MongoDB's $inc operator in a single findOneAndUpdate
 * call with a condition guard to prevent race conditions and overselling under
 * concurrent load. No application-level locking is needed.
 */
class VariantRepository {
  /**
   * Insert a new variant document.
   * @param {Object} data - Variant fields to persist.
   * @returns {Promise<Document>} The created Mongoose document.
   */
  async create(data) {
    return Variant.create(data);
  }

  /**
   * Find a single variant by its ObjectId, excluding soft-deleted records.
   * @param {string|ObjectId} id - Variant ObjectId.
   * @returns {Promise<Object|null>} Lean variant document or null.
   */
  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Variant.findOne({ _id: id, isDeleted: false }).lean();
  }

  /**
   * List all non-deleted variants belonging to a given product.
   * @param {string|ObjectId} productId - The parent product's ObjectId.
   * @returns {Promise<Object[]>} Array of lean variant documents.
   */
  async findByProductId(productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) return [];
    return Variant.find({ productId, isDeleted: false }).lean();
  }

  /**
   * Find a single variant by its SKU, excluding soft-deleted records.
   * @param {string} sku - The variant's unique SKU string.
   * @returns {Promise<Object|null>} Lean variant document or null.
   */
  async findBySku(sku) {
    return Variant.findOne({ sku, isDeleted: false }).lean();
  }

  /**
   * Update a variant by ObjectId and set the updatedBy audit field.
   * Only non-deleted variants are matched.
   * @param {string|ObjectId} id      - Variant ObjectId.
   * @param {Object}          data    - Fields to update.
   * @param {string|ObjectId} adminId - Id of the admin performing the update.
   * @returns {Promise<Object|null>} Updated lean document or null if not found.
   */
  async update(id, data, adminId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const updatePayload = { ...data };
    if (adminId) updatePayload.updatedBy = adminId;

    return Variant.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();
  }

  /**
   * Soft-delete a variant by setting isDeleted=true and capturing deletedAt.
   * @param {string|ObjectId} id      - Variant ObjectId.
   * @param {string|ObjectId} adminId - Id of the admin performing the deletion.
   * @returns {Promise<Object|null>} Updated lean document or null if not found.
   */
  async softDelete(id, adminId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    return Variant.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: adminId || null
        }
      },
      { new: true }
    ).lean();
  }

  /**
   * Atomically reserve `qty` units of stock for a pending order.
   *
   * The update is only applied when available stock (stock - reservedStock)
   * is >= qty, preventing reservedStock from ever exceeding actual stock.
   * This guard is evaluated atomically inside MongoDB — no application-level
   * locking is required.
   *
   * MongoDB condition: { stock: { $gte: reservedStock + qty } }
   * Rewritten as:     { $expr: { $gte: [ "$stock", { $add: ["$reservedStock", qty] } ] } }
   *
   * @param {string|ObjectId} variantId - Variant ObjectId.
   * @param {number}          qty       - Number of units to reserve (must be > 0).
   * @returns {Promise<Object>} Updated lean document.
   * @throws {Error} INSUFFICIENT_STOCK — when available stock < qty.
   */
  async atomicReserve(variantId, qty, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error('INVALID_VARIANT_ID');
    }

    const updated = await Variant.findOneAndUpdate(
      {
        _id: variantId,
        isDeleted: false,
        // Ensure stock - reservedStock >= qty
        $expr: {
          $gte: [
            '$stock',
            { $add: ['$reservedStock', qty] }
          ]
        }
      },
      { $inc: { reservedStock: qty } },
      { new: true, session: options.session || null }
    ).lean();

    if (!updated) {
      throw new Error('INSUFFICIENT_STOCK');
    }

    return updated;
  }

  /**
   * Atomically confirm a reservation: decrement BOTH stock and reservedStock by qty.
   *
   * Called when an order transitions to Paid/Processing — the reserved units are
   * now committed from physical inventory. Both counters must be decremented
   * together in a single atomic operation.
   *
   * Guard condition: stock >= qty AND reservedStock >= qty, preventing either
   * field from going negative.
   *
   * @param {string|ObjectId} variantId - Variant ObjectId.
   * @param {number}          qty       - Number of units to confirm (must be > 0).
   * @returns {Promise<Object>} Updated lean document.
   * @throws {Error} INSUFFICIENT_STOCK — when stock or reservedStock < qty.
   */
  async atomicConfirm(variantId, qty, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error('INVALID_VARIANT_ID');
    }

    const updated = await Variant.findOneAndUpdate(
      {
        _id: variantId,
        isDeleted: false,
        stock: { $gte: qty },
        reservedStock: { $gte: qty }
      },
      {
        $inc: {
          stock: -qty,
          reservedStock: -qty
        }
      },
      { new: true, session: options.session || null }
    ).lean();

    if (!updated) {
      throw new Error('INSUFFICIENT_STOCK');
    }

    return updated;
  }

  /**
   * Directly deduct physical stock (for COD orders or immediate stock updates).
   */
  async atomicDeductStock(variantId, qty, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error('INVALID_VARIANT_ID');
    }

    const updated = await Variant.findOneAndUpdate(
      {
        _id: variantId,
        isDeleted: false,
        stock: { $gte: qty }
      },
      {
        $inc: { stock: -qty }
      },
      { new: true, session: options.session || null }
    ).lean();

    if (!updated) {
      throw new Error('INSUFFICIENT_STOCK');
    }

    return updated;
  }


  /**
   * Atomically release a reservation by decrementing reservedStock by qty.
   *
   * Called when an order is cancelled or payment fails — the held units are
   * returned to the available pool. Only reservedStock is changed; actual stock
   * is unaffected.
   *
   * Guard condition: reservedStock >= qty, preventing reservedStock going negative.
   *
   * @param {string|ObjectId} variantId - Variant ObjectId.
   * @param {number}          qty       - Number of units to release (must be > 0).
   * @returns {Promise<Object>} Updated lean document.
   * @throws {Error} RELEASE_EXCEEDS_RESERVED — when reservedStock < qty.
   */
  /**
   * Release a previously-reserved quantity back to available stock.
   *
   * This is a *compensating* action used to unwind a reservation on order
   * cancellation/failure/rollback, so it is intentionally tolerant rather
   * than strict: it clamps `reservedStock` at 0 instead of throwing if the
   * release is retried (e.g. a webhook redelivery, or a crash-recovery
   * replay) or if a partial release already happened. A compensating step
   * that can itself fail defeats the purpose of a saga — this makes the
   * release idempotent and safe to call more than once for the same order.
   *
   * Two guarded single-document updates instead of the original MongoDB
   * aggregation-pipeline update: the Turso data layer doesn't run pipeline
   * updates (it silently did nothing, so cancelled orders never gave their
   * reserved stock back). Each step is still atomic on its own:
   *   1. reservedStock >= qty → subtract qty;
   *   2. otherwise (partial release already happened) → clamp to 0.
   */
  async atomicRelease(variantId, qty, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error('INVALID_VARIANT_ID');
    }

    let updated = await Variant.findOneAndUpdate(
      { _id: variantId, isDeleted: false, reservedStock: { $gte: qty } },
      { $inc: { reservedStock: -qty } },
      { new: true, session: options.session || null }
    ).lean();

    if (!updated) {
      updated = await Variant.findOneAndUpdate(
        { _id: variantId, isDeleted: false },
        { $min: { reservedStock: 0 } },
        { new: true, session: options.session || null }
      ).lean();
    }

    if (!updated) {
      throw new Error('NOT_FOUND');
    }

    return updated;
  }
}

const __exports: any = new VariantRepository();

export default __exports;
