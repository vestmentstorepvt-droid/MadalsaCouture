// @ts-nocheck — ported from the Express backend (services/variantService.js); logic unchanged.
import __imp0 from "@/server/repositories/variantRepository";
import __imp1 from "@/server/services/productService";
import __imp2 from "@/server/utils/slugify";
import __imp3 from "@/server/constants/messages";
import __imp4 from "@/server/config/logger";
import __imp5 from "@/server/models/variantModel";
import { queueShiprocketSync } from "@/server/services/shiprocketCatalog";

const variantRepository = __imp0;
const productService = __imp1;
const { slugify } = __imp2;
const { ERROR } = __imp3;
const logger = __imp4;

/**
 * Generate a slug-safe, uppercased SKU from variant attributes.
 *
 * Format: {productSlug}-{size}-{color}-{fabric} — fully uppercased with
 * spaces replaced by hyphens via slugify. The result is safe for use as
 * a URL component and unique-index value.
 *
 * @param {string} productSlug - URL slug of the parent product.
 * @param {string} size        - Variant size (e.g. "S", "XL", "Free Size").
 * @param {string} color       - Variant colour (e.g. "Midnight Blue").
 * @param {string} fabric      - Variant fabric (e.g. "Silk Georgette").
 * @returns {string} Auto-generated SKU string.
 */
function generateSku(productSlug, size, color, fabric) {
  const parts = [productSlug, size, color, fabric].map((p) => slugify(String(p)));
  return parts.join('-').toUpperCase();
}

class VariantService {
  /**
   * Create a new variant for an existing product.
   *
   * Business rules:
   *   1. Parent product must exist (404 guard via productService).
   *   2. The (productId, size, color, fabric) combination must be unique — enforced
   *      by the compound unique index; a MongoDB duplicate-key error (code 11000)
   *      is converted to a 409 CONFLICT with a user-friendly message.
   *   3. If `sku` is not supplied in `data`, it is auto-generated from the product
   *      slug + size + color + fabric (uppercased, slug-safe).
   *   4. Global SKU uniqueness is enforced by the unique index on `sku`; the same
   *      duplicate-key error path handles it with a different message.
   *
   * @param {string|ObjectId} productId - Parent product ObjectId.
   * @param {Object}          data      - Variant fields (size, color, fabric, price, …).
   * @param {string|ObjectId} adminId   - ObjectId of the admin creating the variant.
   * @returns {Promise<Object>} Created Mongoose variant document.
   */
  async createVariant(productId, data, adminId) {
    // 1 — Verify parent product exists (throws 404 if not)
    const product = await productService.getProductById(productId);

    const Variant = __imp5;
    const duplicateSizeVariant = await Variant.exists({
      productId,
      size: new RegExp(`^${String(data.size).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      color: data.color,
      fabric: data.fabric,
      isDeleted: false,
    });
    if (duplicateSizeVariant) {
      throw Object.assign(
        new Error('A variant with this size, color, and fabric already exists for this product.'),
        { statusCode: 409, code: 'VARIANT_ALREADY_EXISTS' }
      );
    }

    // 2 — Auto-generate SKU if not provided or handle custom SKU
    let sku = data.sku;
    if (!sku || !String(sku).trim()) {
      const prodSlug = product.slug || slugify(product.title || 'PRD');
      const baseSku = generateSku(prodSlug, data.size, data.color, data.fabric);
      sku = baseSku;
      let counter = 1;
      while (await Variant.exists({ sku })) {
        const archived = await Variant.findOne({ sku, isDeleted: true });
        if (archived) {
          archived.sku = `${sku}-archived-${Date.now()}`;
          await archived.save();
          break;
        }
        sku = `${baseSku}-${counter++}`;
      }
    } else {
      sku = String(sku).trim();
      const existingSku = await Variant.findOne({ sku });
      if (existingSku) {
        if (existingSku.isDeleted) {
          existingSku.sku = `${sku}-archived-${Date.now()}`;
          await existingSku.save();
        } else {
          throw Object.assign(
            new Error(`A variant with SKU '${sku}' already exists. Please enter a unique SKU.`),
            { statusCode: 409 }
          );
        }
      }
    }

    // Build the document to persist
    const payload = {
      ...data,
      images: Array.isArray(data.images) && data.images.length > 0 ? data.images : (product.images || []),
      productId,
      sku,
      createdBy: adminId,
      updatedBy: adminId
    };
    delete payload.shiprocketId;

    if (payload.barcode === null || (typeof payload.barcode === 'string' && !payload.barcode.trim())) {
      payload.barcode = undefined;
    }

    try {
      const variant = await variantRepository.create(payload);
      logger.info(
        `Variant created: ${variant._id} (SKU: ${variant.sku}) for product ${productId} by admin ${adminId}`
      );
      queueShiprocketSync(productId); // new size → Shiprocket
      return variant;
    } catch (err) {
      if (err.code === 11000) {
        const keyPattern = err.keyPattern || {};
        if (keyPattern.barcode) {
          throw Object.assign(
            new Error(`A variant with barcode '${data.barcode}' already exists. Please enter a unique barcode.`),
            { statusCode: 409 }
          );
        }
        throw Object.assign(
          new Error(`A variant with SKU '${sku}' already exists. Please enter a unique SKU.`),
          { statusCode: 409 }
        );
      }
      throw err;
    }
  }




  /**
   * Fetch a single variant by its ObjectId.
   * Throws 404 if the variant does not exist or has been soft-deleted.
   *
   * @param {string|ObjectId} id - Variant ObjectId.
   * @returns {Promise<Object>} Lean variant document.
   */
  async getVariantById(id) {
    const variant = await variantRepository.findById(id);
    if (!variant) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }
    return variant;
  }

  /**
   * List all non-deleted variants belonging to a product.
   *
   * @param {string|ObjectId} productId - Parent product ObjectId.
   * @returns {Promise<Object[]>} Array of lean variant documents.
   */
  async listVariantsByProduct(productId) {
    return variantRepository.findByProductId(productId);
  }

  /**
   * Update a variant's fields.
   *
   * If the caller changes the `sku`, the new value must not already exist on
   * another variant; the repository's unique index will enforce this, and a
   * duplicate-key error is converted to a 409.
   *
   * The `productId` field cannot be changed via this method; it is stripped
   * from the update payload to prevent accidental re-parenting.
   *
   * @param {string|ObjectId} id      - Variant ObjectId.
   * @param {Object}          data    - Fields to update.
   * @param {string|ObjectId} adminId - ObjectId of the admin performing the update.
   * @returns {Promise<Object>} Updated lean variant document.
   */
  async updateVariant(id, data, adminId) {
    // 404 guard — also proves the variant is not deleted
    const currentVariant = await this.getVariantById(id);

    // Prevent accidental re-parenting
    const updatePayload = { ...data };
    delete updatePayload.productId;
    delete updatePayload.shiprocketId;
    if (updatePayload.size !== undefined && updatePayload.size.includes(',')) {
      throw Object.assign(
        new Error('Create one variant per size; comma-separated sizes are not allowed.'),
        { statusCode: 400, code: 'INVALID_VARIANT_SIZE' }
      );
    }

    const nextSize = updatePayload.size || currentVariant.size;
    const nextColor = updatePayload.color || currentVariant.color;
    const nextFabric = updatePayload.fabric || currentVariant.fabric;
    const Variant = __imp5;
    const duplicateSizeVariant = await Variant.exists({
      _id: { $ne: id },
      productId: currentVariant.productId,
      size: new RegExp(`^${String(nextSize).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      color: nextColor,
      fabric: nextFabric,
      isDeleted: false,
    });
    if (duplicateSizeVariant) {
      throw Object.assign(
        new Error('A variant with this size, color, and fabric already exists for this product.'),
        { statusCode: 409, code: 'VARIANT_ALREADY_EXISTS' }
      );
    }

    if (updatePayload.barcode === null || (typeof updatePayload.barcode === 'string' && !updatePayload.barcode.trim())) {
      updatePayload.barcode = undefined;
    }

    try {
      const updated = await variantRepository.update(id, updatePayload, adminId);
      if (!updated) {
        throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
      }
      logger.info(`Variant updated: ${id} by admin ${adminId}`);
      queueShiprocketSync(updated.productId);
      return updated;
    } catch (err) {
      if (err.code === 11000) {
        const keyPattern = err.keyPattern || {};
        if (keyPattern.sku) {
          throw Object.assign(new Error(ERROR.SKU_CONFLICT), { statusCode: 409 });
        }
        if (keyPattern.barcode) {
          throw Object.assign(new Error('A variant with this barcode already exists.'), { statusCode: 409 });
        }
        throw Object.assign(new Error(ERROR.CONFLICT), { statusCode: 409 });
      }
      throw err;
    }
  }

  /**
   * Soft-delete a variant.
   *
   * This method only performs the soft-delete. Callers (e.g. the controller
   * or a higher-level orchestration service) are responsible for any downstream
   * consequences such as updating the parent product status when no published
   * variants remain.
   *
   * @param {string|ObjectId} id      - Variant ObjectId.
   * @param {string|ObjectId} adminId - ObjectId of the admin performing the deletion.
   * @returns {Promise<Object>} Soft-deleted lean variant document.
   */
  async softDeleteVariant(id, adminId) {
    // 404 guard
    await this.getVariantById(id);

    const deleted = await variantRepository.softDelete(id, adminId);
    if (!deleted) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    logger.info(`Variant soft-deleted: ${id} by admin ${adminId}`);
    queueShiprocketSync(deleted.productId); // the product is re-sent without this size
    return deleted;
  }

  /**
   * Reserve stock for a pending order.
   *
   * Delegates to `variantRepository.atomicReserve()`. Converts the repository's
   * `INSUFFICIENT_STOCK` error to a 409 with a user-friendly message from the
   * shared messages constant.
   *
   * @param {string|ObjectId} variantId - Variant ObjectId.
   * @param {number}          qty       - Units to reserve (must be > 0).
   * @returns {Promise<Object>} Updated lean variant document.
   */
  async reserveStock(variantId, qty, options = {}) {
    try {
      return await variantRepository.atomicReserve(variantId, qty, options);
    } catch (err) {
      if (err.message === 'INSUFFICIENT_STOCK') {
        throw Object.assign(
          new Error(ERROR.INSUFFICIENT_STOCK),
          { statusCode: 409, code: 'INSUFFICIENT_STOCK' }
        );
      }
      throw err;
    }
  }

  /**
   * Confirm a stock reservation (order paid/processing).
   *
   * Decrements both `stock` and `reservedStock` atomically. Delegates to
   * `variantRepository.atomicConfirm()`.
   *
   * @param {string|ObjectId} variantId - Variant ObjectId.
   * @param {number}          qty       - Units to confirm (must be > 0).
   * @returns {Promise<Object>} Updated lean variant document.
   */
  async confirmStock(variantId, qty, options = {}) {
    try {
      return await variantRepository.atomicConfirm(variantId, qty, options);
    } catch (err) {
      if (err.message === 'INSUFFICIENT_STOCK') {
        throw Object.assign(
          new Error(ERROR.INSUFFICIENT_STOCK),
          { statusCode: 409, code: 'INSUFFICIENT_STOCK' }
        );
      }
      throw err;
    }
  }

  /**
   * Release a stock reservation (order cancelled or payment failed).
   *
   * Decrements `reservedStock` only; actual stock is unaffected. Delegates to
   * `variantRepository.atomicRelease()`, which is itself clamp-safe/idempotent.
   *
   * @param {string|ObjectId} variantId - Variant ObjectId.
   * @param {number}          qty       - Units to release (must be > 0).
   * @returns {Promise<Object>} Updated lean variant document.
   */
  async releaseStock(variantId, qty, options = {}) {
    return variantRepository.atomicRelease(variantId, qty, options);
  }

  /**
   * Directly deduct physical stock (for COD orders or immediate stock updates).
   */
  async deductStock(variantId, qty, options = {}) {
    try {
      return await variantRepository.atomicDeductStock(variantId, qty, options);
    } catch (err) {
      if (err.message === 'INSUFFICIENT_STOCK') {
        throw Object.assign(
          new Error(ERROR.INSUFFICIENT_STOCK),
          { statusCode: 409, code: 'INSUFFICIENT_STOCK' }
        );
      }
      throw err;
    }
  }
}


const __exports: any = new VariantService();

export default __exports;
