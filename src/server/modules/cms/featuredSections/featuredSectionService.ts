// @ts-nocheck — ported from the Express backend (modules/cms/featuredSections/featuredSectionService.js); logic unchanged.
import __imp0 from "@/server/modules/cms/featuredSections/featuredSection.model";
import __imp1 from "@/server/utils/cmsFilter";
import __imp2 from "@/server/utils/pagination";

const FeaturedSection = __imp0;
const { buildPublicCmsFilter } = __imp1;
const { paginate } = __imp2;

class FeaturedSectionService {
  async createSection(data, actorId) {
    const doc = await FeaturedSection.create({ ...data, createdBy: actorId, updatedBy: actorId });
    return doc.toObject();
  }

  async updateSection(id, data, actorId) {
    return FeaturedSection.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { ...data, updatedBy: actorId, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();
  }

  async deleteSection(id, actorId) {
    return FeaturedSection.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true, updatedBy: actorId, updatedAt: new Date() },
      { new: true }
    ).lean();
  }

  async listSectionsAdmin(queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    let sort = { displayOrder: 1 };
    const filter = { isDeleted: false };
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.search) filter.title = { $regex: queryParams.search, $options: 'i' };
    return paginate(FeaturedSection, filter, { page, limit, sort });
  }

  async listSectionsPublic() {
    const filter = buildPublicCmsFilter();
    return FeaturedSection.find(filter).sort({ displayOrder: 1 }).lean();
  }
}

const __exports: any = new FeaturedSectionService();

export default __exports;
