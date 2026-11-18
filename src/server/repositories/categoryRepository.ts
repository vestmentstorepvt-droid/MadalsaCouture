// @ts-nocheck — ported from the Express backend (repositories/categoryRepository.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/categoryModel";

const mongoose = __imp0;
const Category = __imp1;

/**
 * Repository for Category CRUD and query operations.
 * All read-only queries use .lean() for performance.
 * Soft-deleted documents (isDeleted: true) are excluded from public-facing reads.
 */
class CategoryRepository {
  /**
   * Insert a new category document.
   * @param {Object} data - Category fields to persist.
   * @returns {Promise<Document>} The created Mongoose document.
   */
  async create(data) {
    return Category.create(data);
  }

  /**
   * Find a single category by its ObjectId, excluding soft-deleted records.
   * @param {string|ObjectId} id - Category ObjectId.
   * @returns {Promise<Object|null>} Lean category document or null.
   */
  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Category.findOne({ _id: id, isDeleted: false }).lean();
  }

  /**
   * List categories with optional filtering and pagination.
   *
   * Supported filters:
   *   status    {string}   – 'active' | 'archived'
   *   parentId  {ObjectId|null} – filter by parent (null = top-level only)
   *   isDeleted {boolean}  – defaults to false; pass true to include/show only deleted
   *   search    {string}   – case-insensitive partial match on name
   *
   * Supported pagination options:
   *   page    {number} – 1-based page number (default: 1)
   *   limit   {number} – documents per page (default: 20, max: 100)
   *   sort    {Object} – Mongoose sort spec (default: { displayOrder: 1 })
   *
   * @param {Object} filters    – Filter criteria as described above.
   * @param {Object} pagination – Pagination/sort options as described above.
   * @returns {Promise<{ data: Object[], total: number }>}
   */
  async findAll(filters = {}, pagination = {}) {
    const {
      status,
      parentId,
      isDeleted = false,
      search
    } = filters;

    const {
      page = 1,
      limit = 20,
      sort = { displayOrder: 1 }
    } = pagination;

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const safePage  = Math.max(parseInt(page, 10)  || 1,  1);
    const skip      = (safePage - 1) * safeLimit;

    const query = { isDeleted: Boolean(isDeleted) };

    if (status) query.status = status;

    // parentId: explicit null means top-level only; an ObjectId filters by parent
    if (parentId !== undefined) {
      query.parentId = parentId === null ? null : parentId;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      Category.find(query).sort(sort).skip(skip).limit(safeLimit).lean(),
      Category.countDocuments(query)
    ]);

    return { data, total };
  }

  /**
   * Find all non-deleted direct children of a given parentId.
   * Used for building the category tree.
   * Results are sorted by displayOrder ascending.
   *
   * @param {string|ObjectId} parentId - The parent category ObjectId.
   * @returns {Promise<Object[]>} Array of lean child category documents.
   */
  async findChildren(parentId) {
    if (!mongoose.Types.ObjectId.isValid(parentId)) return [];
    return Category.find({ parentId, isDeleted: false })
      .sort({ displayOrder: 1 })
      .lean();
  }

  /**
   * Update a category by ObjectId and set the updatedBy audit field.
   * Only updates non-deleted categories.
   *
   * @param {string|ObjectId} id      - Category ObjectId.
   * @param {Object}          data    - Fields to update.
   * @param {string|ObjectId} adminId - Id of the admin performing the update.
   * @returns {Promise<Object|null>} Updated lean document or null if not found.
   */
  async update(id, data, adminId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const updatePayload = { ...data };
    if (adminId) updatePayload.updatedBy = adminId;

    return Category.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();
  }

  /**
   * Archive a single category by setting status to 'archived'.
   * Also sets the updatedBy audit field.
   * Only operates on non-deleted categories.
   *
   * @param {string|ObjectId} id      - Category ObjectId.
   * @param {string|ObjectId} adminId - Id of the admin performing the archive.
   * @returns {Promise<Object|null>} Updated lean document or null if not found.
   */
  async archive(id, adminId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const updatePayload = { status: 'archived' };
    if (adminId) updatePayload.updatedBy = adminId;

    return Category.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();
  }

  /**
   * Archive all non-deleted direct children of a given parentId in a single
   * atomic `updateMany` operation.
   *
   * @param {string|ObjectId} parentId - The parent category ObjectId.
   * @param {string|ObjectId} adminId  - Id of the admin performing the archive.
   * @returns {Promise<Object>} MongoDB `UpdateResult` (e.g. { matchedCount, modifiedCount }).
   */
  async archiveChildren(parentId, adminId) {
    const updatePayload = { status: 'archived' };
    if (adminId) updatePayload.updatedBy = adminId;

    return Category.updateMany(
      { parentId, isDeleted: false },
      { $set: updatePayload }
    );
  }

  /**
   * Check whether any non-deleted, non-archived product references this category
   * as either its primary categoryId or subcategoryId.
   *
   * The Product model is resolved lazily via `mongoose.models` to avoid
   * circular dependency issues at require-time.
   *
   * @param {string|ObjectId} categoryId - The category ObjectId to check.
   * @returns {Promise<boolean>} true if at least one active product references this category.
   */
  async hasActiveProducts(categoryId) {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) return false;

    // Resolve Product model lazily to avoid circular-require issues
    const Product =
      mongoose.models.Product || mongoose.model('Product');

    const objectId = new mongoose.Types.ObjectId(categoryId);

    const count = await Product.countDocuments({
      isDeleted: false,
      status: { $ne: 'archived' },
      $or: [
        { categoryId: objectId },
        { subcategoryId: objectId }
      ]
    });

    return count > 0;
  }
}

const __exports: any = new CategoryRepository();

export default __exports;
