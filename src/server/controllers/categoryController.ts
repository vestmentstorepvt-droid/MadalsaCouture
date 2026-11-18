// @ts-nocheck — ported from the Express backend (controllers/categoryController.js); logic unchanged.
import __imp0 from "@/server/services/categoryService";
import __imp1 from "@/server/utils/response";

const categoryService = __imp0;
const { sendSuccess } = __imp1;

/**
 * Parse pagination/sort options from query params.
 *
 * Accepts: ?page=1&limit=20&sort=createdAt:desc
 *
 * @param {object} query - Express req.query
 * @returns {{ page: number, limit: number, sort: object }}
 */
function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  let sort = { displayOrder: 1, createdAt: -1 };
  if (query.sort) {
    const [field, direction] = String(query.sort).split(':');
    if (field) {
      sort = { [field]: direction === 'asc' ? 1 : -1 };
    }
  }

  return { page, limit, sort };
}

class CategoryController {
  // ─── Admin endpoints ────────────────────────────────────────────────────────

  /**
   * POST /api/v1/admin/categories
   * Create a new category. Slug is auto-generated from name.
   */
  async createCategory(req, res, next) {
    try {
      const category = await categoryService.createCategory(req.body, req.user.id);
      return sendSuccess(res, { category }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/categories/:id
   * Update category fields. Slug is regenerated if name changes.
   */
  async updateCategory(req, res, next) {
    try {
      const category = await categoryService.updateCategory(
        req.params.id,
        req.body,
        req.user.id
      );
      return sendSuccess(res, { category });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/categories/:id/archive
   * Archive a category and all its direct subcategories.
   */
  async archiveCategory(req, res, next) {
    try {
      const category = await categoryService.archiveCategory(
        req.params.id,
        req.user.id
      );
      return sendSuccess(res, { category });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/categories/:id
   * Soft-delete a category. Blocked if active products reference it.
   */
  async deleteCategory(req, res, next) {
    try {
      const category = await categoryService.deleteCategory(
        req.params.id,
        req.user.id
      );
      return sendSuccess(res, { category });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/categories/:id  or  GET /api/v1/categories/:id
   * Fetch a single category by ObjectId.
   */
  async getCategory(req, res, next) {
    try {
      const category = await categoryService.getCategoryById(req.params.id);
      return sendSuccess(res, { category });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/categories
   * List all categories for admin — all statuses unless filtered.
   * Supports pagination, filtering by status/parentId/search via query params.
   */
  async listCategories(req, res, next) {
    try {
      const pagination = parsePagination(req.query);

      // Admin sees all non-deleted categories unless a status filter is provided
      const filters = { isDeleted: false };

      const { status, parentId, search } = req.query;

      if (status)   filters.status   = status;
      if (parentId) filters.parentId = parentId;
      if (search)   filters.search   = search;

      const result = await categoryService.listCategories(filters, pagination);
      return sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  // ─── Public endpoints ────────────────────────────────────────────────────────

  /**
   * GET /api/v1/categories/tree
   * Return the full active category tree (top-level + children).
   * Public — no authentication required.
   */
  async getCategoryTree(req, res, next) {
    try {
      const tree = await categoryService.getCategoryTree();
      return sendSuccess(res, { tree });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new CategoryController();

export default __exports;
