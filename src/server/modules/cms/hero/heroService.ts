// @ts-nocheck — ported from the Express backend (modules/cms/hero/heroService.js); logic unchanged.
import __imp0 from "@/server/modules/cms/hero/hero.model";
import __imp1 from "@/server/utils/cmsFilter";

const Hero = __imp0;
const { buildPublicCmsFilter } = __imp1;

/**
 * Hero CMS Service
 *
 * Encapsulates all data-access logic for the hero singleton module.
 * The hero collection should only ever contain ONE document, which is
 * created or updated via upsert operations.
 */
class HeroService {
  /**
   * Upsert the hero document (create if it doesn't exist, update if it does).
   *
   * This is the core singleton pattern: we find the first document in the
   * collection (regardless of _id) and update it. If no document exists,
   * we create one.
   *
   * @param {Object} data - Hero fields from the request body
   * @param {string} actorId - ObjectId of the authenticated admin
   * @returns {Promise<Object>} The upserted hero document (lean)
   */
  async upsertHero(data, actorId) {
    const heroData = { ...data };
    if (!Array.isArray(heroData.media) || heroData.media.length === 0) {
      if (heroData.mediaUrl) {
        heroData.media = [{
          mediaType: heroData.mediaType || 'image',
          mediaUrl: heroData.mediaUrl
        }];
      }
    }

    if (Array.isArray(heroData.media) && heroData.media.length > 0) {
      heroData.mediaType = heroData.media[0].mediaType;
      heroData.mediaUrl = heroData.media[0].mediaUrl;
    }

    // Find the first non-deleted hero document (there should only be one)
    const existing = await Hero.findOne({ isDeleted: false }).lean();

    if (existing) {
      // Update the existing hero
      const updated = await Hero.findByIdAndUpdate(
        existing._id,
        {
          ...heroData,
          updatedBy: actorId,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      ).lean();
      return updated;
    }

    // No hero exists — create a new one
    const hero = await Hero.create({
      ...heroData,
      createdBy: actorId,
      updatedBy: actorId
    });
    return hero.toObject();
  }

  /**
   * Get the hero document for the admin panel.
   *
   * Returns the hero regardless of status or schedule — admin sees everything.
   *
   * @returns {Promise<Object|null>} The hero document (lean), or null if not found
   */
  async getHeroAdmin() {
    return Hero.findOne({ isDeleted: false }).lean();
  }

  /**
   * Get the hero document for the public storefront.
   *
   * Applies the shared CMS public filter (active status, schedule-filtered).
   * Returns null if the hero is not currently active or within schedule window.
   *
   * @returns {Promise<Object|null>} The hero document (lean), or null if not visible
   */
  async getHeroPublic() {
    const filter = buildPublicCmsFilter();
    return Hero.findOne(filter).lean();
  }
}

const __exports: any = new HeroService();

export default __exports;
