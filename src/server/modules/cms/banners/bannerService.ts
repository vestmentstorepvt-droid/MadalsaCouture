// @ts-nocheck — ported from the Express backend (modules/cms/banners/bannerService.js); logic unchanged.
import __imp0 from "@/server/modules/cms/banners/banner.model";
import __imp1 from "@/server/utils/cmsFilter";
import __imp2 from "@/server/utils/pagination";

const Banner = __imp0;
const { buildPublicCmsFilter } = __imp1;
const { paginate } = __imp2;

/**
 * Banner CMS Service
 *
 * Encapsulates all data-access logic for the banners multi-document module.
 * Multiple banners can exist per named placement and are ordered by `priority` asc.
 */
class BannerService {
  /**
   * Create a new banner document.
   *
   * @param {Object} data - Banner fields from the request body
   * @param {string} actorId - ObjectId of the authenticated admin
   * @returns {Promise<Object>} The created banner (lean)
   */
  async createBanner(data, actorId) {
    const banner = await Banner.create({
      ...data,
      createdBy: actorId,
      updatedBy: actorId
    });
    return banner.toObject();
  }

  /**
   * Update an existing banner by ID.
   *
   * Only operates on non-deleted documents.
   *
   * @param {string} id - Banner ObjectId
   * @param {Object} data - Fields to update
   * @param {string} actorId - ObjectId of the authenticated admin
   * @returns {Promise<Object|null>} Updated banner (lean), or null if not found
   */
  async updateBanner(id, data, actorId) {
    return Banner.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { ...data, updatedBy: actorId, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();
  }

  /**
   * Soft-delete a banner by ID.
   *
   * @param {string} id - Banner ObjectId
   * @param {string} actorId - ObjectId of the authenticated admin
   * @returns {Promise<Object|null>} Deleted banner (lean), or null if not found
   */
  async deleteBanner(id, actorId) {
    return Banner.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true, updatedBy: actorId, updatedAt: new Date() },
      { new: true }
    ).lean();
  }

  /**
   * List all (non-deleted) banners for the admin panel — paginated.
   *
   * Supports filtering by placement, status, and a title search term.
   *
   * @param {Object} queryParams - Express req.query (page, limit, sort, placement, status, search)
   * @returns {Promise<{ data: Object[], meta: Object }>}
   */
  async listBannersAdmin(queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));

    let sort = { placement: 1, priority: 1 };
    if (queryParams.sort) {
      const [field, direction] = String(queryParams.sort).split(':');
      if (field) sort = { [field]: direction === 'asc' ? 1 : -1 };
    }

    const filter = { isDeleted: false };

    if (queryParams.placement) filter.placement = queryParams.placement;
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.search) {
      filter.title = { $regex: queryParams.search, $options: 'i' };
    }

    return paginate(Banner, filter, { page, limit, sort });
  }

  /**
   * Get all visible banners for a named placement — public storefront.
   *
   * Applies the shared CMS public filter (active, non-deleted, within schedule
   * window), then further filters by placement and sorts by `priority` ascending
   * so lower-numbered banners are returned first.
   *
   * @param {string} placement - The placement slot name (e.g. 'homepage-hero')
   * @returns {Promise<Object[]>} Lean array of visible banners for the placement
   */
  async getBannersByPlacement(placement) {
    const filter = {
      ...buildPublicCmsFilter(),
      placement
    };
    return Banner.find(filter).sort({ priority: 1 }).lean();
  }
}

const __exports: any = new BannerService();

export default __exports;
