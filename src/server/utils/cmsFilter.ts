// @ts-nocheck — ported from the Express backend (utils/cmsFilter.js); logic unchanged.


/**
 * CMS Filter Utility
 *
 * Provides a shared Mongoose query filter for all CMS public endpoints.
 * Ensures only active, non-deleted content within the scheduled time window
 * is returned to storefront clients.
 */

/**
 * Returns the Mongoose query filter for public CMS content.
 * Filters out:
 *  - Soft-deleted documents (isDeleted: true)
 *  - Inactive documents (status !== 'active')
 *  - Documents whose scheduled window hasn't started yet (startsAt > now)
 *  - Documents whose scheduled window has already ended (endsAt < now)
 *
 * null startsAt means "no start restriction" (always available from the past).
 * null endsAt means "no expiry" (always available into the future).
 *
 * @returns {object} Mongoose query filter object
 */
function buildPublicCmsFilter() {
  return {
    isDeleted: false,
    status: 'active',
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: new Date() } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: new Date() } }] },
    ],
  };
}

const __exports: any = { buildPublicCmsFilter };

export default __exports;
