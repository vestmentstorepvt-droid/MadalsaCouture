// @ts-nocheck — ported from the Express backend (modules/cms/hero/heroController.js); logic unchanged.
import __imp0 from "@/server/modules/cms/hero/heroService";
import __imp1 from "@/server/utils/response";

const heroService = __imp0;
const { sendSuccess, sendError } = __imp1;

const COLLECTION_NAME = 'heroes';

/**
 * Helper: schedule an async version snapshot once the response is sent.
 * Fire-and-forget — does not block the HTTP response cycle.
 *
 * @param {Object} res - Express response object
 * @param {string|Object} documentId - MongoDB ObjectId of the hero document
 * @param {Object} snapshot - Full document state to snapshot
 * @param {string} editorId - ObjectId of the acting admin
 */

// ─────────────────────────────────────────────────────────────────────────────
// Admin handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/v1/admin/cms/hero
 * Upsert the hero singleton.
 *
 * Creates the hero if it doesn't exist, or updates the existing one.
 * This is the only mutating endpoint for the hero module.
 */
async function upsertHero(req, res, next) {
  try {
    const hero = await heroService.upsertHero(req.body, req.user.id);
    return sendSuccess(res, { hero }, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/cms/hero
 * Get the hero singleton for the admin panel.
 *
 * Returns the hero regardless of status or schedule.
 */
async function getHeroAdmin(req, res, next) {
  try {
    const hero = await heroService.getHeroAdmin();
    if (!hero) {
      return sendError(res, 'NOT_FOUND', 'Hero not configured yet.', 404);
    }
    return sendSuccess(res, { hero });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/cms/hero
 * Get the hero singleton for the public storefront.
 *
 * Returns the hero only if it is active and within the scheduled window.
 * No authentication required.
 */
async function getHeroPublic(req, res, next) {
  try {
    const hero = await heroService.getHeroPublic();
    if (!hero) {
      return sendError(res, 'NOT_FOUND', 'Hero not available.', 404);
    }
    return sendSuccess(res, { hero });
  } catch (error) {
    next(error);
  }
}

const __exports: any = {
  upsertHero,
  getHeroAdmin,
  getHeroPublic
};

export default __exports;
