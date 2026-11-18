// @ts-nocheck — ported from the Express backend (repositories/mediaRepository.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/mediaAssetModel";
import __imp2 from "@/server/utils/pagination";
import __imp3 from "@/server/models/productModel";
import __imp4 from "@/server/models/variantModel";
import __imp5 from "@/server/modules/cms/banners/banner.model";

const mongoose = __imp0;
const MediaAsset = __imp1;
const { paginate } = __imp2;

/**
 * Repository for MediaAsset CRUD and reference-tracking operations.
 *
 * All read queries use .lean() for performance unless a Mongoose document
 * is required for further chaining. Soft-deleted assets (isDeleted: true)
 * are excluded from every public-facing read.
 */
class MediaRepository {
  /**
   * Insert a new media asset document.
   *
   * @param {Object} data - Fields to persist (cloudinaryPublicId, url, format, …).
   * @returns {Promise<Object>} Plain JS object representation of the created document.
   */
  async create(data) {
    const doc = await MediaAsset.create(data);
    return doc.toObject();
  }

  /**
   * Paginated list of non-deleted media assets.
   *
   * Supported filters:
   *   folder        {string}   – exact match on the folder field
   *   tags          {string[]} – asset must have at least one of the provided tags ($in)
   *   resourceType  {string}   – 'image' | 'video' | 'raw'
   *   search        {string}   – case-insensitive regex on cloudinaryPublicId or folder
   *
   * @param {Object} filters         - Filter criteria (see above).
   * @param {number} [page=1]        - 1-based page number.
   * @param {number} [limit=20]      - Documents per page (max 100).
   * @returns {Promise<{ data: Object[], meta: { pagination: Object } }>}
   */
  async findAll(filters = {}, page = 1, limit = 20) {
    const { folder, tags, resourceType, search } = filters;

    const query = { isDeleted: false };

    if (folder !== undefined && folder !== null && folder !== '') {
      query.folder = folder;
    }

    if (tags && tags.length > 0) {
      query.tags = { $in: Array.isArray(tags) ? tags : [tags] };
    }

    if (resourceType) {
      query.resourceType = resourceType;
    }

    if (search) {
      const regex = { $regex: search, $options: 'i' };
      query.$or = [
        { cloudinaryPublicId: regex },
        { folder: regex }
      ];
    }

    return paginate(MediaAsset, query, {
      page,
      limit,
      sort: { createdAt: -1 }
    });
  }

  /**
   * Find a single media asset by its MongoDB ObjectId, excluding soft-deleted records.
   *
   * @param {string|ObjectId} id - MediaAsset ObjectId.
   * @returns {Promise<Object|null>} Lean document or null.
   */
  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return MediaAsset.findOne({ _id: id, isDeleted: false }).lean();
  }

  /**
   * Find a single media asset by its Cloudinary public ID, excluding soft-deleted records.
   *
   * @param {string} cloudinaryPublicId - The Cloudinary public ID (e.g. 'madalsa/products/abc').
   * @returns {Promise<Object|null>} Lean document or null.
   */
  async findByPublicId(cloudinaryPublicId) {
    return MediaAsset.findOne({ cloudinaryPublicId, isDeleted: false }).lean();
  }

  /**
   * Soft-delete a media asset by setting isDeleted=true and capturing deletedAt.
   *
   * @param {string|ObjectId} id - MediaAsset ObjectId.
   * @returns {Promise<Object|null>} Updated lean document or null if not found.
   */
  async softDelete(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    return MediaAsset.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    ).lean();
  }

  /**
   * Search for active references to a media asset URL across related collections.
   *
   * IMPORTANT: Always pass the Cloudinary delivery URL (asset.url), NOT the public_id.
   * Product and Variant images store URLs, not public IDs.
   *
   * Collections and fields checked:
   *   - products → images[].url  (imageObjectSchema array — query on nested field)
   *   - variants → images[].url  (imageObjectSchema array — query on nested field)
   *   - banners  → imageUrl      (single string field)
   *
   * @param {string} assetUrl - The Cloudinary delivery URL to search for.
   */
  async findReferences(assetUrl) {
    const Product = mongoose.models.Product || __imp3;
    const Variant  = mongoose.models.Variant  || __imp4;

    const Banner =
      mongoose.models.Banner ||
      __imp5;

    const activeFilter = {
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    };

    const [products, variants, banners] = await Promise.all([
      // products.images is [imageObjectSchema] — query on the url sub-field
      Product.find({ ...activeFilter, 'images.url': assetUrl }).select('_id').lean(),

      // variants.images is now [imageObjectSchema] — same query pattern
      Variant.find({ ...activeFilter, 'images.url': assetUrl }).select('_id').lean(),

      // banners.imageUrl is a plain string
      Banner.find({ ...activeFilter, imageUrl: assetUrl }).select('_id').lean(),
    ]);

    const references = [];
    for (const doc of products) references.push({ collection: 'products', entityId: doc._id });
    for (const doc of variants) references.push({ collection: 'variants', entityId: doc._id });
    for (const doc of banners)  references.push({ collection: 'banners',  entityId: doc._id });

    return references;
  }

  /**
   * Increment (or decrement) the referenceCount of a media asset atomically.
   *
   * @param {string|ObjectId} id    - MediaAsset ObjectId.
   * @param {number}          delta - Amount to add (use negative value to decrement).
   * @returns {Promise<Object|null>} Updated lean document or null if not found.
   */
  async incrementReferenceCount(id, delta) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    return MediaAsset.findByIdAndUpdate(
      id,
      { $inc: { referenceCount: delta } },
      { new: true }
    ).lean();
  }
}

const __exports: any = new MediaRepository();

export default __exports;
