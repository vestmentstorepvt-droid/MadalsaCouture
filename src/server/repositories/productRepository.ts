// @ts-nocheck — ported from the Express backend (repositories/productRepository.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/productModel";

const mongoose = __imp0;
const Product = __imp1;

/**
 * Repository for Product CRUD and query operations.
 * All read-only queries use .lean() for performance.
 * Soft-deleted documents (isDeleted: true) are always excluded.
 */
class ProductRepository {
  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  async create(data) {
    return Product.create(data);
  }

  async update(id, data, adminId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const payload = { ...data };
    if (adminId) payload.updatedBy = adminId;
    return Product.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: payload },
      { new: true, runValidators: true }
    ).lean();
  }

  async softDelete(id, adminId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Product.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: adminId || null } },
      { new: true }
    ).lean();
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Product.findOne({ _id: id, isDeleted: false }).lean();
  }

  async findBySlug(slug) {
    return Product.findOne({ slug, isDeleted: false }).lean();
  }

  /**
   * List products with optional filtering and pagination.
   *
   * Supported filters:
   *   status, categoryId, subcategoryId, collectionIds, tagIds
   *   minPrice, maxPrice, search
   *   gender, ageGroup, designer, brand, season
   *   occasions        {string}  — product must include this occasion ($in)
   *   isFeatured, isNewArrival, isBestSeller, isTrending,
   *   isLimitedEdition, isPreOrder, isReadyToShip, isMadeToOrder  {boolean}
   *   isDeleted        {boolean} — default false
   */
  async findAll(filters = {}, pagination = {}) {
    const {
      status, categoryId, subcategoryId, collectionIds, tagIds,
      isDeleted = false, minPrice, maxPrice, search,
      gender, ageGroup, designer, brand, season, occasions,
      isFeatured, isNewArrival, isBestSeller, isTrending,
      isLimitedEdition, isPreOrder, isReadyToShip, isMadeToOrder,
    } = filters;

    const { page = 1, limit = 20, sort = { createdAt: -1 } } = pagination;

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const safePage  = Math.max(parseInt(page, 10) || 1, 1);
    const skip      = (safePage - 1) * safeLimit;

    const query = { isDeleted: Boolean(isDeleted) };

    // ── Taxonomy ──────────────────────────────────────────────────────────
    if (status)        query.status        = status;
    if (categoryId)    query.categoryId    = categoryId;
    if (subcategoryId) query.subcategoryId = subcategoryId;

    if (collectionIds) {
      query.collectionIds = {
        $in: Array.isArray(collectionIds) ? collectionIds : [collectionIds],
      };
    }
    if (tagIds) {
      query.tagIds = {
        $in: Array.isArray(tagIds) ? tagIds : [tagIds],
      };
    }

    // ── Pricing ──────────────────────────────────────────────────────────
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.basePrice = {};
      if (minPrice !== undefined) query.basePrice.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.basePrice.$lte = Number(maxPrice);
    }

    // ── Text search ──────────────────────────────────────────────────────
    if (search) query.title = { $regex: search, $options: 'i' };

    // ── Attributes ───────────────────────────────────────────────────────
    if (gender)   query.gender   = gender;
    if (ageGroup) query.ageGroup = ageGroup;
    if (season)   query.season   = season;

    if (designer) query.designer = { $regex: designer, $options: 'i' };
    if (brand)    query.brand    = { $regex: brand,    $options: 'i' };

    if (occasions) query.occasions = { $in: Array.isArray(occasions) ? occasions : [occasions] };

    // ── Flags ────────────────────────────────────────────────────────────
    if (isFeatured     === true || isFeatured     === 'true')  query['flags.isFeatured']     = true;
    if (isNewArrival   === true || isNewArrival   === 'true')  query['flags.isNewArrival']   = true;
    if (isBestSeller   === true || isBestSeller   === 'true')  query['flags.isBestSeller']   = true;
    if (isTrending     === true || isTrending     === 'true')  query['flags.isTrending']     = true;
    if (isLimitedEdition === true || isLimitedEdition === 'true') query['flags.isLimitedEdition'] = true;
    if (isPreOrder     === true || isPreOrder     === 'true')  query['flags.isPreOrder']     = true;
    if (isReadyToShip  === true || isReadyToShip  === 'true')  query['flags.isReadyToShip']  = true;
    if (isMadeToOrder  === true || isMadeToOrder  === 'true')  query['flags.isMadeToOrder']  = true;

    const [data, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(safeLimit).lean(),
      Product.countDocuments(query),
    ]);

    return { data, total };
  }

  // ---------------------------------------------------------------------------
  // Business logic helpers
  // ---------------------------------------------------------------------------

  /**
   * Find products referenced by at least one active order.
   * Used as a pre-delete safety check.
   */
  async findWithActiveOrders(productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) return [];
    const Order = mongoose.models.Order || mongoose.model('Order');
    const INACTIVE = ['Cancelled', 'Delivered', 'Refunded'];
    return Order.find({
      'items.productId': new mongoose.Types.ObjectId(productId),
      status: { $nin: INACTIVE },
    })
      .select('_id orderNumber status')
      .lean();
  }
}

const __exports: any = new ProductRepository();

export default __exports;
