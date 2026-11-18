// @ts-nocheck — ported from the Express backend (modules/cms/staticPages/staticPageService.js); logic unchanged.
import __imp0 from "@/server/modules/cms/staticPages/staticPage.model";
import __imp1 from "@/server/utils/slugify";
import __imp2 from "@/server/utils/pagination";

const StaticPage = __imp0;
const { slugify } = __imp1;
const { paginate } = __imp2;

class StaticPageService {
  async _generateUniqueSlug(title, excludeId = null) {
    const base = slugify(title);
    let candidate = base;
    let counter = 2;
    while (true) {
      const filter = { slug: candidate };
      if (excludeId) filter._id = { $ne: excludeId };
      const existing = await StaticPage.exists(filter);
      if (!existing) break;
      candidate = `${base}-${counter}`;
      counter += 1;
    }
    return candidate;
  }

  async createPage(data, actorId) {
    const slug = data.slug
      ? slugify(data.slug)
      : await this._generateUniqueSlug(data.title);
    const page = await StaticPage.create({ ...data, slug, createdBy: actorId, updatedBy: actorId });
    return page.toObject();
  }

  async updatePage(id, data, actorId) {
    const updateData = { ...data, updatedBy: actorId, updatedAt: new Date() };
    if (data.title && !data.slug) {
      updateData.slug = await this._generateUniqueSlug(data.title, id);
    } else if (data.slug) {
      updateData.slug = slugify(data.slug);
    }
    return StaticPage.findOneAndUpdate(
      { _id: id, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    ).lean();
  }

  async deletePage(id, actorId) {
    return StaticPage.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true, updatedBy: actorId, updatedAt: new Date() },
      { new: true }
    ).lean();
  }

  async listPagesAdmin(queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    let sort = { createdAt: -1 };
    if (queryParams.sort) {
      const [field, direction] = String(queryParams.sort).split(':');
      if (field) sort = { [field]: direction === 'asc' ? 1 : -1 };
    }
    const filter = { isDeleted: false };
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.search) {
      filter.$or = [
        { title: { $regex: queryParams.search, $options: 'i' } },
        { slug: { $regex: queryParams.search, $options: 'i' } }
      ];
    }
    return paginate(StaticPage, filter, { page, limit, sort });
  }

  async getPageBySlugPublic(slug) {
    return StaticPage.findOne({ slug, status: 'published', isDeleted: false }).lean();
  }
}

const __exports: any = new StaticPageService();

export default __exports;
