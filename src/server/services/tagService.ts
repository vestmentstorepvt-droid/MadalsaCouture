// @ts-nocheck — ported from the Express backend (services/tagService.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/tagModel";
import __imp2 from "@/server/utils/slugify";
import __imp3 from "@/server/constants/messages";
import __imp4 from "@/server/config/logger";
import __imp5 from "@/server/models/productModel";

const mongoose = __imp0;
const Tag = __imp1;
const { slugify } = __imp2;
const { ERROR, SUCCESS } = __imp3;
const logger = __imp4;

class TagService {
  /**
   * Generate a unique slug for a tag name.
   * Appends -2, -3, … until a collision-free slug is found.
   * When updating, the tag's own slug is excluded from the collision check.
   *
   * @param {string}      name      - Tag name to slugify.
   * @param {string|null} excludeId - ObjectId of the tag being updated (optional).
   * @returns {Promise<string>} Collision-free slug.
   */
  async _generateUniqueSlug(name, excludeId = null) {
    const base = slugify(name);
    let candidate = base;
    let counter = 2;

    for (;;) {
      const existing = await Tag.findOne({ slug: candidate, isDeleted: false }).lean();
      if (!existing) break;
      // The slug belongs to the very tag we are updating — keep it
      if (excludeId && existing._id && existing._id.toString() === excludeId.toString()) break;
      candidate = `${base}-${counter}`;
      counter += 1;
    }

    return candidate;
  }

  /**
   * Create a new tag.
   * Slug is auto-generated from name.
   * Duplicate name is enforced by the case-insensitive collation index (err.code 11000 → 409).
   *
   * @param {Object} data    - Tag fields from the request body.
   * @param {string} adminId - ObjectId of the admin creating the tag.
   * @returns {Promise<Document>} Created Mongoose document.
   */
  async createTag(data, adminId) {
    const slug = await this._generateUniqueSlug(data.name);

    try {
      const tag = await Tag.create({
        ...data,
        slug,
        createdBy: adminId,
        updatedBy: adminId
      });

      logger.info(`Tag created: ${tag._id} (${tag.slug}) by admin ${adminId}`);
      return tag;
    } catch (err) {
      if (err.code === 11000) {
        throw Object.assign(new Error(ERROR.DUPLICATE_TAG), { statusCode: 409 });
      }
      throw err;
    }
  }

  /**
   * Fetch a single tag by its ObjectId.
   * Throws 404 if not found or soft-deleted.
   *
   * @param {string} id - Tag ObjectId.
   * @returns {Promise<Object>} Lean tag document.
   */
  async getTagById(id) {
    const tag = await Tag.findOne({ _id: id, isDeleted: false }).lean();
    if (!tag) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }
    return tag;
  }

  /**
   * List tags with optional filtering and pagination.
   *
   * @param {Object} filters    - Filter criteria (search, isDeleted).
   * @param {Object} pagination - Pagination options (page, limit, sort).
   * @returns {Promise<{ data: Object[], meta: { pagination: Object } }>}
   */
  async listTags(filters = {}, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const safePage  = Math.max(parseInt(page, 10) || 1, 1);

    const query = {};

    // isDeleted filter — default to showing non-deleted
    if (typeof filters.isDeleted === 'boolean') {
      query.isDeleted = filters.isDeleted;
    } else {
      query.isDeleted = false;
    }

    // Optional name search via regex
    if (filters.search) {
      query.name = { $regex: filters.search, $options: 'i' };
    }

    const sort = pagination.sort || { name: 1 };
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      Tag.find(query).sort(sort).skip(skip).limit(safeLimit).lean(),
      Tag.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / safeLimit);

    return {
      data,
      meta: {
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages
        }
      }
    };
  }

  /**
   * Soft-delete a tag.
   *
   * Pre-delete safety check: rejects with 409 CONFLICT if any non-deleted
   * product references this tag in its `tagIds` array.
   *
   * @param {string} id      - Tag ObjectId.
   * @param {string} adminId - ObjectId of the admin performing the deletion.
   * @returns {Promise<Object>} The soft-deleted lean tag document.
   */
  async deleteTag(id, adminId) {
    await this.getTagById(id); // throws 404 if not found

    // Lazy-load Product model to avoid circular dependency issues
    const Product = mongoose.models.Product || __imp5;

    const productUsingTag = await Product.findOne({
      tagIds: id,
      isDeleted: false
    }).lean();

    if (productUsingTag) {
      throw Object.assign(
        new Error(ERROR.CONFLICT),
        { statusCode: 409 }
      );
    }

    const now = new Date();
    const deleted = await Tag.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: now, updatedBy: adminId } },
      { new: true, lean: true }
    );

    if (!deleted) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    logger.info(`Tag soft-deleted: ${id} by admin ${adminId}`);
    return deleted;
  }
}

const __exports: any = new TagService();

export default __exports;
