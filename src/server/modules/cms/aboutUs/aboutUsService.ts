// @ts-nocheck — ported from the Express backend (modules/cms/aboutUs/aboutUsService.js); logic unchanged.
import __imp0 from "@/server/modules/cms/aboutUs/aboutUs.model";
import __imp1 from "@/server/utils/cmsFilter";

const AboutUs = __imp0;
const { buildPublicCmsFilter } = __imp1;

class AboutUsService {
  async upsertAboutUs(data, actorId) {
    const existing = await AboutUs.findOne({ isDeleted: false }).lean();
    if (existing) {
      return AboutUs.findByIdAndUpdate(
        existing._id,
        { ...data, updatedBy: actorId, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).lean();
    }
    const doc = await AboutUs.create({ ...data, createdBy: actorId, updatedBy: actorId });
    return doc.toObject();
  }

  async getAboutUsAdmin() {
    return AboutUs.findOne({ isDeleted: false }).lean();
  }

  async getAboutUsPublic() {
    const filter = buildPublicCmsFilter();
    return AboutUs.findOne(filter).lean();
  }
}

const __exports: any = new AboutUsService();

export default __exports;
