// @ts-nocheck — ported from the Express backend (modules/cms/banners/bannerController.js); logic unchanged.
import __imp0 from "@/server/modules/cms/banners/bannerService";
import __imp1 from "@/server/utils/response";

const bannerService = __imp0;
const { sendSuccess, sendError } = __imp1;

const COLLECTION_NAME = 'banners';

/**
 * Helper: schedule an async version snapshot once the response is sent.
 * Fire-and-forget — does not block the HTTP response cycle.
 *
 * @param {Object} res - Express response object
 * @param {string|Object} documentId - MongoDB ObjectId of the affected banner
 * @param {Object} snapshot - Full document state to snapshot
 * @param {string} editorId - ObjectId of the acting admin
 */

// ─────────────────────────────────────────────────────────────────────────────
// Admin handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/cms/banners
 * Create a new banner.
 */
async function createBanner(req, res, next) {
  try {
    const banner = await bannerService.createBanner(req.body, req.user.id);
    return sendSuccess(res, { banner }, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/cms/banners
 * List all banners (paginated) for the admin panel.
 * Supports ?placement=, ?status=, ?search=, ?page=, ?limit=, ?sort=
 */
async function listBannersAdmin(req, res, next) {
  try {
    const result = await bannerService.listBannersAdmin(req.query);
    return sendSuccess(res, { banners: result.data }, 200, result.meta);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/admin/cms/banners/:id
 * Update an existing banner.
 */
async function updateBanner(req, res, next) {
  try {
    const banner = await bannerService.updateBanner(req.params.id, req.body, req.user.id);
    if (!banner) {
      return sendError(res, 'NOT_FOUND', 'Banner not found.', 404);
    }
    return sendSuccess(res, { banner });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/admin/cms/banners/:id
 * Soft-delete a banner.
 */
async function deleteBanner(req, res, next) {
  try {
    const banner = await bannerService.deleteBanner(req.params.id, req.user.id);
    if (!banner) {
      return sendError(res, 'NOT_FOUND', 'Banner not found.', 404);
    }
    return sendSuccess(res, { banner });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/cms/banners/:placement
 * Return all visible banners for the requested placement slot.
 * Schedule-filtered, active-only, sorted by priority ascending.
 * No authentication required.
 */
async function getBannersByPlacement(req, res, next) {
  try {
    const banners = await bannerService.getBannersByPlacement(req.params.placement);
    return sendSuccess(res, { banners });
  } catch (error) {
    next(error);
  }
}

const __exports: any = {
  createBanner,
  listBannersAdmin,
  updateBanner,
  deleteBanner,
  getBannersByPlacement
};

export default __exports;
