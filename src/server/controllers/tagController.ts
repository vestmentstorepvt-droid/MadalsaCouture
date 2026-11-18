// @ts-nocheck — ported from the Express backend (controllers/tagController.js); logic unchanged.
import __imp0 from "@/server/services/tagService";
import __imp1 from "@/server/utils/response";

const tagService = __imp0;
const { sendSuccess } = __imp1;

/**
 * Parse pagination options from query params.
 *
 * Accepts: ?page=1&limit=20
 *
 * @param {object} query - Express req.query
 * @returns {{ page: number, limit: number, sort: object }}
 */
function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const sort  = { name: 1 };
  return { page, limit, sort };
}

class TagController {
  // ─── Admin endpoints ─────────────────────────────────────────────────────────

  /**
   * POST /api/v1/admin/tags
   * Create a new tag. Slug is auto-generated from name.
   */
  async createTag(req, res, next) {
    try {
      const tag = await tagService.createTag(req.body, req.user.id);
      return sendSuccess(res, { tag }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/tags
   * Admin tag list — supports optional ?search= filter and pagination.
   */
  async adminListTags(req, res, next) {
    try {
      const pagination = parsePagination(req.query);

      const filters = { isDeleted: false };
      if (req.query.search) filters.search = req.query.search;

      const result = await tagService.listTags(filters, pagination);
      return sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/tags/:id
   * Soft-delete a tag. Blocked if any non-deleted product references it.
   */
  async deleteTag(req, res, next) {
    try {
      const tag = await tagService.deleteTag(req.params.id, req.user.id);
      return sendSuccess(res, { tag });
    } catch (error) {
      next(error);
    }
  }

  // ─── Public endpoints ────────────────────────────────────────────────────────

  /**
   * GET /api/v1/tags
   * List all active (non-deleted) tags sorted by name.
   * Public — no authentication required.
   */
  async listTags(req, res, next) {
    try {
      const result = await tagService.listTags(
        { isDeleted: false },
        { page: 1, limit: 100, sort: { name: 1 } }
      );
      return sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new TagController();

export default __exports;
