// @ts-nocheck — ported from the Express backend (modules/cms/announcementBar/announcementBarController.js); logic unchanged.
import __imp0 from "@/server/modules/cms/announcementBar/announcementBarService";
import __imp1 from "@/server/utils/response";

const announcementBarService = __imp0;
const { sendSuccess, sendError } = __imp1;

const COLLECTION_NAME = 'announcement_bars';

/**
 * Helper: schedule an async version snapshot once the response is sent.
 * Fire-and-forget — does not block the HTTP response cycle.
 *
 * @param {Object} res - Express response object
 * @param {string|Object} documentId - MongoDB ObjectId of the announcement bar document
 * @param {Object} snapshot - Full document state to snapshot
 * @param {string} editorId - ObjectId of the acting admin
 */

// ─────────────────────────────────────────────────────────────────────────────
// Admin handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/v1/admin/cms/announcement-bar
 * Upsert the announcement bar singleton.
 *
 * Creates the announcement bar if it doesn't exist, or updates the existing one.
 * This is the only mutating endpoint for this module.
 */
async function upsertAnnouncementBar(req, res, next) {
  try {
    const announcementBar = await announcementBarService.upsertAnnouncementBar(
      req.body,
      req.user.id
    );
    return sendSuccess(res, { announcementBar }, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/cms/announcement-bar
 * Get the announcement bar singleton for the admin panel.
 *
 * Returns the document regardless of status or schedule.
 */
async function getAnnouncementBarAdmin(req, res, next) {
  try {
    const announcementBar = await announcementBarService.getAnnouncementBarAdmin();
    if (!announcementBar) {
      return sendError(res, 'NOT_FOUND', 'Announcement bar not configured yet.', 404);
    }
    return sendSuccess(res, { announcementBar });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/cms/announcement-bar
 * Get the announcement bar singleton for the public storefront.
 *
 * Returns the document only if it is active and within the scheduled window.
 * No authentication required.
 */
async function getAnnouncementBarPublic(req, res, next) {
  try {
    const announcementBar = await announcementBarService.getAnnouncementBarPublic();
    if (!announcementBar) {
      return sendError(res, 'NOT_FOUND', 'Announcement bar not available.', 404);
    }
    return sendSuccess(res, { announcementBar });
  } catch (error) {
    next(error);
  }
}

const __exports: any = {
  upsertAnnouncementBar,
  getAnnouncementBarAdmin,
  getAnnouncementBarPublic
};

export default __exports;
