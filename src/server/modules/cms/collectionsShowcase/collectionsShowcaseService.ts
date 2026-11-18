// @ts-nocheck — ported from the Express backend (modules/cms/collectionsShowcase/collectionsShowcaseService.js); logic unchanged.
import __imp0 from "@/server/modules/cms/collectionsShowcase/collectionsShowcase.model";

const CollectionsShowcase = __imp0;

class CollectionsShowcaseService {
  /**
   * Replace (upsert) the showcase document.
   * @param {Array<{name,slug,imageUrl,isActive,displayOrder}>} items
   * @param {string} actorId
   */
  async upsertShowcase(items, actorId) {
    const payload = Array.isArray(items) ? items : [];

    const existing = await CollectionsShowcase.findOne({ isDeleted: false }).lean();
    if (existing) {
      return CollectionsShowcase.findByIdAndUpdate(
        existing._id,
        { items: payload, updatedBy: actorId },
        { new: true, runValidators: true }
      ).lean();
    }

    const doc = await CollectionsShowcase.create({
      items: payload,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return doc.toObject();
  }

  async getShowcaseAdmin() {
    const doc = await CollectionsShowcase.findOne({ isDeleted: false }).lean();
    if (!doc) return [];
    return [...doc.items].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }

  async getShowcasePublic() {
    const doc = await CollectionsShowcase.findOne({ isDeleted: false }).lean();
    if (!doc) return [];
    return doc.items
      .filter((item) => item.isActive !== false)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }
}

const __exports: any = new CollectionsShowcaseService();

export default __exports;
