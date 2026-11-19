// @ts-nocheck — ported from the Express backend (services/collectionService.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/collectionModel";
import __imp2 from "@/server/utils/slugify";
import __imp3 from "@/server/utils/pagination";
import __imp4 from "@/server/constants/messages";
import __imp5 from "@/server/config/logger";
import { queueShiprocketCollectionSync } from "@/server/services/shiprocketCatalog";

const mongoose = __imp0;
const Collection = __imp1;
const { slugify } = __imp2;
const { paginate } = __imp3;
const { ERROR } = __imp4;
const logger = __imp5;

class CollectionService {
  // ---------------------------------------------------------------------------
  // Slug helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate a unique slug from a collection name.
   * Appends -2, -3, … until a collision-free slug is found.
   * When updating, the collection's own slug is excluded from the check.
   *
   * @param {string}      name      - Collection name to slugify.
   * @param {string|null} excludeId - ObjectId of the collection being updated (optional).
   * @returns {Promise<string>} Collision-free slug.
   */
  async _generateUniqueSlug(name, excludeId = null) {
    const base = slugify(name);
    let candidate = base;
    let counter = 2;

    for (;;) {
      const existing = await Collection.findOne({ slug: candidate, isDeleted: false }).lean();
      if (!existing) break;
      // The slug already belongs to the collection we are updating — keep it
      if (excludeId && existing._id && existing._id.toString() === excludeId.toString()) break;
      candidate = `${base}-${counter}`;
      counter += 1;
    }

    return candidate;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create a new collection.
   * Slug is auto-generated from the name; uniqueness is guaranteed via suffix loop.
   *
   * @param {Object} data    - Collection fields from the request body.
   * @param {string} adminId - ObjectId of the admin creating the collection.
   * @returns {Promise<Object>} Created Mongoose document (lean).
   */
  async createCollection(data, adminId) {
    const slug = await this._generateUniqueSlug(data.name);

    const collectionData = { ...data };
    delete collectionData.shiprocketId;

    const collection = await Collection.create({
      ...collectionData,
      slug,
      createdBy: adminId,
      updatedBy: adminId
    });

    logger.info(`Collection created: ${collection._id} (${collection.slug}) by admin ${adminId}`);
    queueShiprocketCollectionSync(collection._id); // keep Shiprocket Checkout's catalog in step
    return collection.toObject();
  }

  /**
   * Fetch a single collection by its ObjectId.
   * Throws 404 if not found or soft-deleted.
   *
   * @param {string} id - Collection ObjectId.
   * @returns {Promise<Object>} Lean collection document.
   */
  async getCollectionById(id) {
    const collection = await Collection.findOne({ _id: id, isDeleted: false }).lean();
    if (!collection) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }
    return collection;
  }

  /**
   * Fetch a single collection by its URL slug.
   * Throws 404 if not found or soft-deleted.
   *
   * @param {string} slug - URL-safe collection slug.
   * @returns {Promise<Object>} Lean collection document.
   */
  async getCollectionBySlug(slug) {
    const collection = await Collection.findOne({ slug, isDeleted: false }).lean();
    if (!collection) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }
    return collection;
  }

  /**
   * List collections with optional filtering and pagination.
   *
   * Supported filters:
   *   - status   : 'active' | 'inactive'
   *   - type     : 'manual' | 'rule-based'
   *   - search   : case-insensitive name substring match
   *   - isDeleted: defaults to false when not supplied
   *
   * @param {Object} filters    - Filter criteria.
   * @param {Object} pagination - Pagination options (page, limit, sort).
   * @returns {Promise<{ data: Object[], meta: { pagination: Object } }>}
   */
  async listCollections(filters = {}, pagination = {}) {
    const query = { isDeleted: false };

    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.search) query.name = { $regex: filters.search, $options: 'i' };

    // Allow explicit isDeleted override (e.g. admin trash view)
    if (typeof filters.isDeleted === 'boolean') query.isDeleted = filters.isDeleted;

    const sort = pagination.sort || { createdAt: -1 };

    return paginate(Collection, query, {
      page: pagination.page,
      limit: pagination.limit,
      sort
    });
  }

  /**
   * Update a collection's fields.
   * Regenerates the slug if the name has changed.
   *
   * @param {string} id      - Collection ObjectId.
   * @param {Object} data    - Fields to update.
   * @param {string} adminId - ObjectId of the admin performing the update.
   * @returns {Promise<Object>} Updated lean collection document.
   */
  async updateCollection(id, data, adminId) {
    const existing = await this.getCollectionById(id); // throws 404 if not found

    const updatePayload = { ...data, updatedBy: adminId };
    delete updatePayload.shiprocketId;

    // Regenerate slug only when name actually changes
    if (data.name && data.name !== existing.name) {
      updatePayload.slug = await this._generateUniqueSlug(data.name, id);
    }

    const updated = await Collection.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    logger.info(`Collection updated: ${id} by admin ${adminId}`);
    queueShiprocketCollectionSync(id);
    return updated;
  }

  /**
   * Soft-delete a collection.
   * Sets isDeleted: true and records deletedAt timestamp.
   *
   * @param {string} id      - Collection ObjectId.
   * @param {string} adminId - ObjectId of the admin performing the deletion.
   * @returns {Promise<Object>} Soft-deleted lean collection document.
   */
  async softDeleteCollection(id, adminId) {
    await this.getCollectionById(id); // throws 404 if not found

    const deleted = await Collection.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: adminId
        }
      },
      { new: true }
    ).lean();

    if (!deleted) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    logger.info(`Collection soft-deleted: ${id} by admin ${adminId}`);
    queueShiprocketCollectionSync(id); // sent as inactive
    return deleted;
  }

  // ---------------------------------------------------------------------------
  // Rule engine — core collection resolver
  // ---------------------------------------------------------------------------

  /**
   * Resolve the products that belong to a collection.
   *
   * Returns lightweight product objects suitable for collection listing pages.
   * Fields returned: _id, title, slug, basePrice, mrp, images, flags, status.
   * Full product documents are NOT returned — use GET /products/:slug for details.
   *
   * For `type === 'manual'`:  resolves productIds[] filtered to published + non-deleted.
   * For `type === 'rule-based'`: evaluates rules[] at query time; respects scheduling.
   */
  async resolveProducts(collection) {
    const Product = mongoose.models.Product || mongoose.model('Product');

    // Lightweight projection for collection listing — avoid overfetch
    const LISTING_PROJECTION = 'title slug basePrice mrp images primaryImage flags status';

    // ── Manual collection ──────────────────────────────────────────────────
    if (collection.type === 'manual') {
      if (!Array.isArray(collection.productIds) || collection.productIds.length === 0) {
        return [];
      }

      return Product.find({
        _id: { $in: collection.productIds },
        isDeleted: false,
        status: 'published',
      })
        .select(LISTING_PROJECTION)
        .sort({ createdAt: -1 })
        .lean();
    }

    // ── Rule-based collection ──────────────────────────────────────────────
    if (collection.type === 'rule-based') {
      const now = new Date();

      if (collection.startsAt && now < new Date(collection.startsAt)) return [];
      if (collection.endsAt   && now > new Date(collection.endsAt))   return [];

      const query = { isDeleted: false, status: 'published' };

      if (Array.isArray(collection.rules)) {
        for (const rule of collection.rules) {
          if (!rule || !rule.field || !rule.operator) continue;
          const { field, operator, value } = rule;

          switch (operator) {
            case 'eq':
              query[field] = value;
              break;
            case 'in':
              query[field] = { $in: Array.isArray(value) ? value : [value] };
              break;
            case 'gte':
              if (!query[field] || typeof query[field] !== 'object') query[field] = {};
              query[field].$gte = value;
              break;
            case 'lte':
              if (!query[field] || typeof query[field] !== 'object') query[field] = {};
              query[field].$lte = value;
              break;
            default:
              logger.warn(`collectionService.resolveProducts: unknown operator '${operator}' — skipped`);
          }
        }
      }

      return Product.find(query).select(LISTING_PROJECTION).sort({ createdAt: -1 }).lean();
    }

    logger.warn(`collectionService.resolveProducts: unknown collection type '${collection.type}'`);
    return [];
  }
}

const __exports: any = new CollectionService();

export default __exports;
