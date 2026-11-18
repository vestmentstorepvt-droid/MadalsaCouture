// @ts-nocheck — ported from the Express backend (modules/cms/videoCards/videoCardService.js); logic unchanged.
import __imp0 from "@/server/modules/cms/videoCards/videoCard.model";
import __imp1 from "@/server/utils/cmsFilter";

const VideoCard = __imp0;
const { buildPublicCmsFilter } = __imp1;

class VideoCardService {
  async create(data, actorId) {
    const card = await VideoCard.create({
      ...data,
      createdBy: actorId,
      updatedBy: actorId
    });
    return card.toObject();
  }

  async listAdmin() {
    return VideoCard.find({ isDeleted: false }).sort({ displayOrder: 1, createdAt: 1 }).lean();
  }

  async update(id, data, actorId) {
    return VideoCard.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { ...data, updatedBy: actorId, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();
  }

  async delete(id, actorId) {
    return VideoCard.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true, status: 'inactive', updatedBy: actorId, updatedAt: new Date() },
      { new: true }
    ).lean();
  }

  async listPublic() {
    return VideoCard.find(buildPublicCmsFilter())
      .sort({ displayOrder: 1, createdAt: 1 })
      .select('title description videoUrl posterUrl linkUrl buttonText displayOrder')
      .lean();
  }
}

const __exports: any = new VideoCardService();

export default __exports;
