// @ts-nocheck — ported from the Express backend (modules/cms/announcementBar/announcementBarService.js); logic unchanged.
import __imp0 from "@/server/modules/cms/announcementBar/announcementBar.model";
import __imp1 from "@/server/utils/cmsFilter";

const AnnouncementBar = __imp0;
const { buildPublicCmsFilter } = __imp1;

/**
 * Announcement Bar CMS Service
 *
 * Encapsulates all data-access logic for the announcement bar singleton module.
 * The announcement_bars collection should only ever contain ONE document, which is
 * created or updated via upsert operations.
 */
class AnnouncementBarService {
  /**
   * Upsert the announcement bar document (create if it doesn't exist, update if it does).
   *
   * This is the core singleton pattern: we find the first document in the
   * collection (regardless of _id) and update it. If no document exists,
   * we create one.
   *
   * @param {Object} data - Announcement bar fields from the request body
   * @param {string} actorId - ObjectId of the authenticated admin
   * @returns {Promise<Object>} The upserted announcement bar document (lean)
   */
  async upsertAnnouncementBar(data, actorId) {
    // Find the first non-deleted document (there should only be one)
    const existing = await AnnouncementBar.findOne({ isDeleted: false }).lean();

    if (existing) {
      // Update the existing document
      const updated = await AnnouncementBar.findByIdAndUpdate(
        existing._id,
        {
          ...data,
          updatedBy: actorId,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      ).lean();
      return updated;
    }

    // No document exists — create a new one
    const announcementBar = await AnnouncementBar.create({
      ...data,
      createdBy: actorId,
      updatedBy: actorId
    });
    return announcementBar.toObject();
  }

  /**
   * Get the announcement bar document for the admin panel.
   *
   * Returns the document regardless of status or schedule — admin sees everything.
   *
   * @returns {Promise<Object|null>} The announcement bar document (lean), or null if not found
   */
  async getAnnouncementBarAdmin() {
    return AnnouncementBar.findOne({ isDeleted: false }).lean();
  }

  /**
   * Get the announcement bar document for the public storefront.
   *
   * Applies the shared CMS public filter (active status, schedule-filtered).
   * Returns null if the bar is not currently active or within schedule window.
   *
   * @returns {Promise<Object|null>} The announcement bar document (lean), or null if not visible
   */
  async getAnnouncementBarPublic() {
    const filter = buildPublicCmsFilter();
    return AnnouncementBar.findOne(filter).lean();
  }
}

const __exports: any = new AnnouncementBarService();

export default __exports;
