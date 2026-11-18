// @ts-nocheck — ported from the Express backend (services/categoryService.js); logic unchanged.
import __imp0 from "@/server/repositories/categoryRepository";
import __imp1 from "@/server/models/categoryModel";
import __imp2 from "@/server/utils/slugify";
import __imp3 from "@/server/constants/messages";
import __imp4 from "@/server/config/logger";

const categoryRepository = __imp0;
const Category = __imp1;
const { slugify } = __imp2;
const { ERROR } = __imp3;
const logger = __imp4;

class CategoryService {
  /**
   * Generate a unique slug for a category name.
   * Appends -2, -3, … until a collision-free slug is found.
   * When updating, the category's own slug is excluded from the collision check.
   *
   * @param {string}      name      - Category name to slugify.
   * @param {string|null} excludeId - ObjectId of the category being updated (optional).
   * @returns {Promise<string>} Collision-free slug.
   */
  async _generateUniqueSlug(name, excludeId = null) {
    const base = slugify(name);
    let candidate = base;
    let counter = 2;

    for (;;) {
      // findAll with a search would be too broad; query directly via Category model
      const existing = await Category.findOne({ slug: candidate, isDeleted: false }).lean();
      if (!existing) break;
      // The slug belongs to the very category we are updating — keep it
      if (excludeId && existing._id && existing._id.toString() === excludeId.toString()) break;
      candidate = `${base}-${counter}`;
      counter += 1;
    }

    return candidate;
  }

  /**
   * Create a new category.
   * Slug is auto-generated from name; uniqueness is guaranteed via suffix loop.
   *
   * @param {Object}      data    - Category fields from the request body.
   * @param {string}      adminId - ObjectId of the admin creating the category.
   * @returns {Promise<Document>} Created Mongoose document.
   */
  async createCategory(data, adminId) {
    const slug = await this._generateUniqueSlug(data.name);

    const category = await categoryRepository.create({
      ...data,
      slug,
      createdBy: adminId,
      updatedBy: adminId
    });

    logger.info(`Category created: ${category._id} (${category.slug}) by admin ${adminId}`);
    return category;
  }

  /**
   * Fetch a single category by its ObjectId.
   * Throws 404 if not found or soft-deleted.
   *
   * @param {string} id - Category ObjectId.
   * @returns {Promise<Object>} Lean category document.
   */
  async getCategoryById(id) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }
    return category;
  }

  /**
   * List categories with optional filtering and pagination.
   * Delegates to categoryRepository.findAll() and wraps the result with
   * pagination meta for the response envelope.
   *
   * @param {Object} filters    - Filter criteria (status, parentId, search, etc.).
   * @param {Object} pagination - Pagination options (page, limit, sort).
   * @returns {Promise<{ data: Object[], meta: { pagination: Object } }>}
   */
  async listCategories(filters = {}, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const safePage  = Math.max(parseInt(page, 10) || 1, 1);

    const { data, total } = await categoryRepository.findAll(filters, {
      ...pagination,
      page: safePage,
      limit: safeLimit
    });

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
   * Update a category's fields.
   * Regenerates the slug if the name has changed.
   *
   * @param {string} id      - Category ObjectId.
   * @param {Object} data    - Fields to update.
   * @param {string} adminId - ObjectId of the admin performing the update.
   * @returns {Promise<Object>} Updated lean category document.
   */
  async updateCategory(id, data, adminId) {
    const existing = await this.getCategoryById(id); // throws 404 if not found

    const updatePayload = { ...data, updatedBy: adminId };

    // Regenerate slug only when name actually changes
    if (data.name && data.name !== existing.name) {
      updatePayload.slug = await this._generateUniqueSlug(data.name, id);
    }

    const updated = await categoryRepository.update(id, updatePayload, adminId);
    if (!updated) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    logger.info(`Category updated: ${id} by admin ${adminId}`);
    return updated;
  }

  /**
   * Archive a category and all its direct subcategories atomically.
   *
   * Steps:
   *   1. Fetch the category (throws 404 if not found).
   *   2. Archive the category itself via categoryRepository.archive().
   *   3. Archive all direct children via categoryRepository.archiveChildren().
   *
   * @param {string} id      - Category ObjectId.
   * @param {string} adminId - ObjectId of the admin performing the archive.
   * @returns {Promise<Object>} The archived lean category document.
   */
  async archiveCategory(id, adminId) {
    await this.getCategoryById(id); // throws 404 if not found

    const archived = await categoryRepository.archive(id, adminId);
    if (!archived) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    await categoryRepository.archiveChildren(id, adminId);

    logger.info(`Category archived: ${id} (and its children) by admin ${adminId}`);
    return archived;
  }

  /**
   * Soft-delete a category and all its direct subcategories.
   *
   * Pre-delete safety check: rejects with 409 CONFLICT if any active (non-archived,
   * non-deleted) product references this category.
   *
   * Steps:
   *   1. Check for active products via categoryRepository.hasActiveProducts().
   *   2. Soft-delete the category: set isDeleted + deletedAt.
   *   3. Soft-delete all direct children in one atomic updateMany call.
   *
   * @param {string} id      - Category ObjectId.
   * @param {string} adminId - ObjectId of the admin performing the deletion.
   * @returns {Promise<Object>} The soft-deleted lean category document.
   */
  async deleteCategory(id, adminId) {
    await this.getCategoryById(id); // throws 404 if not found

    const hasProducts = await categoryRepository.hasActiveProducts(id);
    if (hasProducts) {
      throw Object.assign(
        new Error(ERROR.CANNOT_DELETE_WITH_ACTIVE_PRODUCTS),
        { statusCode: 409 }
      );
    }

    const now = new Date();

    const deleted = await categoryRepository.update(
      id,
      { isDeleted: true, deletedAt: now },
      adminId
    );
    if (!deleted) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    // Soft-delete all direct children atomically
    await Category.updateMany(
      { parentId: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: now } }
    );

    logger.info(`Category soft-deleted: ${id} (and its children) by admin ${adminId}`);
    return deleted;
  }

  /**
   * Build the public-facing category tree.
   *
   * Fetches all top-level active categories (parentId: null, status: 'active',
   * isDeleted: false), sorted by displayOrder, then attaches their active
   * direct children via categoryRepository.findChildren().
   *
   * @returns {Promise<Array<{ _id, name, slug, ..., children: Object[] }>>}
   *   Array of top-level category objects each containing a `children` array.
   */
  async getCategoryTree() {
    const { data: topLevel } = await categoryRepository.findAll(
      { status: 'active', parentId: null, isDeleted: false },
      { sort: { displayOrder: 1 }, limit: 100, page: 1 }
    );

    const tree = await Promise.all(
      topLevel.map(async (category) => {
        const children = await categoryRepository.findChildren(category._id);
        // Only include active (non-archived) children in the public tree
        const activeChildren = children.filter((c) => c.status === 'active');
        return { ...category, children: activeChildren };
      })
    );

    return tree;
  }
}

const __exports: any = new CategoryService();

export default __exports;
