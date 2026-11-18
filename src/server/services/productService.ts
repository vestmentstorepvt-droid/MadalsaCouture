// @ts-nocheck — ported from the Express backend (services/productService.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/repositories/productRepository";
import __imp2 from "@/server/utils/slugify";
import __imp3 from "@/server/constants/messages";
import __imp4 from "@/server/config/logger";

const mongoose = __imp0;
const productRepository = __imp1;
const { slugify } = __imp2;
const { ERROR } = __imp3;
const logger = __imp4;

// ---------------------------------------------------------------------------
// Status state machine
// ---------------------------------------------------------------------------
const VALID_STATUSES = ['draft', 'published', 'archived'];

const STATUS_TRANSITIONS = {
  draft:     ['published', 'archived'],
  published: ['draft', 'archived'],
  archived:  ['draft'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute discount percentage from mrp and basePrice.
 * Returns 0 when mrp is null, 0, or <= basePrice.
 */
function computeDiscountPercent(basePrice, mrp) {
  if (!mrp || mrp <= 0 || mrp <= basePrice) return 0;
  return Math.round(((mrp - basePrice) / mrp) * 100);
}

/**
 * Strip internal audit/soft-delete fields from a lean product document
 * before returning it on a public endpoint.
 */
function stripInternalFields(product) {
  if (!product) return product;
  const clone = { ...product };
  delete clone.createdBy;
  delete clone.updatedBy;
  delete clone.isDeleted;
  delete clone.deletedAt;
  return clone;
}

/**
 * Build a lightweight product summary used for related / cross-sell / up-sell lists.
 * Returns only: _id, title, slug, basePrice, mrp, discountPercent, primaryImage.
 */
function buildProductSummary(product) {
  const primaryImage =
    (product.images || []).find((img) => img.role === 'primary')?.url ||
    (product.images || [])[0]?.url ||
    null;

  return {
    _id:             product._id,
    title:           product.title,
    slug:            product.slug,
    basePrice:       product.basePrice,
    mrp:             product.mrp || null,
    discountPercent: computeDiscountPercent(product.basePrice, product.mrp),
    primaryImage,
  };
}

/**
 * Lazily resolve the Variant model to avoid circular-dependency at load time.
 */
function getVariantModel() {
  return mongoose.models.Variant || mongoose.model('Variant');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
class ProductService {
  // ── Slug generation ────────────────────────────────────────────────────────

  async _generateUniqueSlug(title, excludeId = null) {
    const base = slugify(title);
    let candidate = base;
    let counter = 2;

    for (;;) {
      const existing = await productRepository.findBySlug(candidate);
      if (!existing) break;
      if (excludeId && existing._id && existing._id.toString() === excludeId.toString()) break;
      candidate = `${base}-${counter}`;
      counter += 1;
    }

    return candidate;
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async createProduct(data, adminId) {
    if (!data.title || !String(data.title).trim()) {
      throw Object.assign(new Error('Product title is required.'), { statusCode: 400 });
    }
    if (data.basePrice === undefined || data.basePrice === null) {
      throw Object.assign(new Error('Base price is required.'), { statusCode: 400 });
    }
    if (typeof data.basePrice !== 'number' || data.basePrice < 0) {
      throw Object.assign(new Error('Base price must be a non-negative number.'), { statusCode: 400 });
    }

    const slug = await this._generateUniqueSlug(data.title);

    // Enforce exactly one primary image and set primaryImage field
    if (data.images && Array.isArray(data.images)) {
      let primaryFound = false;
      for (const img of data.images) {
        if (img.role === 'primary') {
          if (!primaryFound) {
            primaryFound = true;
            data.primaryImage = img.url;
          } else {
            img.role = 'gallery';
          }
        }
      }
      if (!primaryFound && data.images.length > 0) {
        data.images[0].role = 'primary';
        data.primaryImage = data.images[0].url;
      }
    }

    const productData = { ...data };
    delete productData.shiprocketId;

    const product = await productRepository.create({
      ...productData,
      slug,
      status: 'draft',
      createdBy: adminId,
      updatedBy: adminId,
    });

    logger.info(`Product created: ${product._id} (${product.slug}) by admin ${adminId}`);
    return product;
  }

  async getProductById(id) {
    const product = await productRepository.findById(id);
    if (!product) throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    return product;
  }

  /**
   * Public product detail — the one-stop API.
   * Returns: product + category + subcategory + tags + variants + related +
   *          crossSell + upSell + discountPercent
   * Strips all internal audit fields.
   */
  async getProductBySlug(slug) {
    const rawSlug = decodeURIComponent(String(slug || '')).trim();
    const normalizedSlug = rawSlug.toLowerCase().replace(/\s+/g, '-');
    let product = await productRepository.findBySlug(normalizedSlug);
    if (!product && rawSlug !== normalizedSlug) {
      product = await productRepository.findBySlug(rawSlug);
    }
    if (!product) throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });


    const Variant = getVariantModel();

    // Run all enrichment queries in parallel
    const [
      category,
      subcategory,
      tags,
      collections,
      variants,
      relatedProducts,
      crossSellProducts,
      upSellProducts,
    ] = await Promise.all([
      // Category
      product.categoryId
        ? mongoose.models.Category?.findById(product.categoryId).select('_id name slug').lean()
        : null,

      // Subcategory
      product.subcategoryId
        ? mongoose.models.Category?.findById(product.subcategoryId).select('_id name slug').lean()
        : null,

      // Tags
      product.tagIds?.length
        ? mongoose.models.Tag?.find({ _id: { $in: product.tagIds }, isDeleted: false })
            .select('_id name slug')
            .lean()
        : [],

      // Collections
      product.collectionIds?.length
        ? mongoose.models.Collection?.find({ _id: { $in: product.collectionIds }, isDeleted: false })
            .select('_id name slug')
            .lean()
        : [],

      // Variants (public fields only)
      Variant.find({ productId: product._id, isDeleted: false })
        .select('_id size color fabric price stock reservedStock images sku barcode weight dimensions')
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean(),

      // Related products — max 6, lightweight summary
      product.relatedProductIds?.length
        ? mongoose.models.Product?.find({
            _id: { $in: product.relatedProductIds.slice(0, 6) },
            isDeleted: false,
            status: 'published',
          })
            .select('_id title slug basePrice mrp images primaryImage')
            .lean()
        : [],

      // Cross-sell — max 6
      product.crossSellIds?.length
        ? mongoose.models.Product?.find({
            _id: { $in: product.crossSellIds.slice(0, 6) },
            isDeleted: false,
            status: 'published',
          })
            .select('_id title slug basePrice mrp images primaryImage')
            .lean()
        : [],

      // Up-sell — max 6
      product.upSellIds?.length
        ? mongoose.models.Product?.find({
            _id: { $in: product.upSellIds.slice(0, 6) },
            isDeleted: false,
            status: 'published',
          })
            .select('_id title slug basePrice mrp images primaryImage')
            .lean()
        : [],
    ]);

    // Add computed availability to each variant
    const enrichedVariants = (variants || []).map((v) => ({
      ...v,
      available: Math.max(0, (v.stock || 0) - (v.reservedStock || 0)),
    }));

    // Compute stock availability — true when at least one variant has available > 0
    const inStock = enrichedVariants.length > 0
      ? enrichedVariants.some((v) => v.available > 0)
      : false;

    // Build breadcrumb
    const breadcrumb = [];
    if (category) breadcrumb.push({ name: category.name, slug: category.slug });
    if (subcategory) breadcrumb.push({ name: subcategory.name, slug: subcategory.slug });

    // Build enriched response — strip internal fields
    const base = stripInternalFields(product);

    return {
      ...base,
      // Replace raw ObjectId fields with populated objects
      category:    category    || null,
      subcategory: subcategory || null,
      tags:        tags        || [],
      collections: collections || [],
      breadcrumb,
      inStock,
      variants:      enrichedVariants,
      relatedProducts:  (relatedProducts  || []).map(buildProductSummary),
      crossSellProducts: (crossSellProducts || []).map(buildProductSummary),
      upSellProducts:    (upSellProducts    || []).map(buildProductSummary),
      discountPercent: computeDiscountPercent(product.basePrice, product.mrp),
    };
  }

  async listProducts(filters = {}, pagination = {}) {
    const resolvedFilters = { ...filters };

    // Resolve categoryId if it is passed as a slug (e.g. "ethnic", "western")
    if (resolvedFilters.categoryId && !mongoose.Types.ObjectId.isValid(resolvedFilters.categoryId)) {
      const CategoryModel = mongoose.models.Category || mongoose.model('Category');
      const category = await CategoryModel.findOne({ slug: resolvedFilters.categoryId, isDeleted: false }).lean();
      resolvedFilters.categoryId = category ? category._id : new mongoose.Types.ObjectId();
    }

    // Resolve subcategoryId if it is passed as a slug
    if (resolvedFilters.subcategoryId && !mongoose.Types.ObjectId.isValid(resolvedFilters.subcategoryId)) {
      const CategoryModel = mongoose.models.Category || mongoose.model('Category');
      const subcategory = await CategoryModel.findOne({ slug: resolvedFilters.subcategoryId, isDeleted: false }).lean();
      resolvedFilters.subcategoryId = subcategory ? subcategory._id : new mongoose.Types.ObjectId();
    }

    const { page = 1, limit = 20 } = pagination;

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const safePage  = Math.max(parseInt(page, 10) || 1, 1);

    const { data, total } = await productRepository.findAll(resolvedFilters, {
      ...pagination,
      page: safePage,
      limit: safeLimit,
    });

    // Batch-check stock availability for all products in this page
    const Variant = getVariantModel();
    const productIds = data.map(p => p._id);

    // Aggregate: for each product, is there at least one variant with computed
    // available stock > 0. Uses $expr so it works even if the pre-save hook
    // that maintains `availableStock` hasn't run for some documents.
    const stockAgg = await Variant.aggregate([
      {
        $match: {
          productId: { $in: productIds },
          isDeleted: false,
        }
      },
      {
        $addFields: {
          computedAvailable: {
            $max: [0, { $subtract: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$reservedStock', 0] }] }]
          }
        }
      },
      { $match: { computedAvailable: { $gt: 0 } } },
      { $group: { _id: '$productId' } }
    ]);
    const inStockSet = new Set(stockAgg.map(r => r._id.toString()));

    // Append computed discountPercent and inStock to every item
    const enriched = data.map(p => ({
      ...p,
      discountPercent: computeDiscountPercent(p.basePrice, p.mrp),
      inStock: inStockSet.has(p._id.toString()),
    }));

    return {
      data: enriched,
      meta: {
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
        },
      },
    };
  }

  async updateProduct(id, data, adminId) {
    const existing = await this.getProductById(id);

    const updatePayload = { ...data, updatedBy: adminId };
    delete updatePayload.shiprocketId;

    // Enforce exactly one primary image and set primaryImage field
    if (updatePayload.images && Array.isArray(updatePayload.images)) {
      let primaryFound = false;
      for (const img of updatePayload.images) {
        if (img.role === 'primary') {
          if (!primaryFound) {
            primaryFound = true;
            updatePayload.primaryImage = img.url;
          } else {
            img.role = 'gallery';
          }
        }
      }
      if (!primaryFound && updatePayload.images.length > 0) {
        updatePayload.images[0].role = 'primary';
        updatePayload.primaryImage = updatePayload.images[0].url;
      }
    }

    if (data.title && data.title !== existing.title) {
      updatePayload.slug = await this._generateUniqueSlug(data.title, id);
    }

    // Status can only be changed via updateProductStatus
    delete updatePayload.status;

    const updated = await productRepository.update(id, updatePayload, adminId);
    if (!updated) throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });

    logger.info(`Product updated: ${id} by admin ${adminId}`);
    return updated;
  }

  async updateProductStatus(id, status, adminId) {
    if (!VALID_STATUSES.includes(status)) {
      throw Object.assign(
        new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`),
        { statusCode: 400 }
      );
    }

    const product = await this.getProductById(id);

    const allowed = STATUS_TRANSITIONS[product.status] || [];
    if (!allowed.includes(status)) {
      throw Object.assign(
        new Error(
          `Cannot transition from '${product.status}' to '${status}'. ` +
            `Allowed: ${allowed.join(', ') || 'none'}.`
        ),
        { statusCode: 409 }
      );
    }

    if (status === 'published') {
      await this._validatePublishConditions(product);
    }

    const updated = await productRepository.update(id, { status }, adminId);
    if (!updated) throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });

    logger.info(`Product ${id} status: ${product.status} → ${status} by admin ${adminId}`);
    return updated;
  }

  async _validatePublishConditions(product) {
    const failures = [];

    if (!product.seo?.metaTitle || !String(product.seo.metaTitle).trim()) {
      failures.push('seo.metaTitle is required to publish a product.');
    }

    let Variant;
    try {
      Variant = mongoose.model('Variant');
    } catch (_) {
      if (failures.length > 0) {
        throw Object.assign(new Error(ERROR.PUBLISH_CONDITIONS_UNMET), {
          statusCode: 422,
          details: failures,
        });
      }
      return;
    }

    const variants = await Variant.find({ productId: product._id, isDeleted: false }).lean();

    if (!variants || variants.length === 0) {
      failures.push('At least one variant is required to publish a product.');
    } else {
      const hasImage = (Array.isArray(product.images) && product.images.length > 0) ||
        variants.some((v) => Array.isArray(v.images) && v.images.length > 0);
      if (!hasImage) {
        failures.push('At least one image (on product or variant) is required to publish a product.');
      }
    }


    if (failures.length > 0) {
      throw Object.assign(new Error(ERROR.PUBLISH_CONDITIONS_UNMET), {
        statusCode: 422,
        details: failures,
      });
    }
  }

  async softDeleteProduct(id, adminId) {
    await this.getProductById(id);

    const activeOrders = await productRepository.findWithActiveOrders(id);
    if (activeOrders && activeOrders.length > 0) {
      throw Object.assign(new Error(ERROR.CANNOT_DELETE_WITH_ACTIVE_ORDERS), { statusCode: 409 });
    }

    const deleted = await productRepository.softDelete(id, adminId);
    if (!deleted) throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });

    logger.info(`Product soft-deleted: ${id} by admin ${adminId}`);
    return deleted;
  }

  // ── Variant listing (public) ───────────────────────────────────────────────

  /**
   * Public variant listing for a product.
   * Returns only storefront-safe fields; no internal audit data.
   */
  async listPublicVariants(productId) {
    const Variant = getVariantModel();

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    const variants = await Variant.find({ productId, isDeleted: false })
      .select('_id size color fabric price stock reservedStock images sku barcode weight dimensions')
      .sort({ createdAt: 1 })
      .lean();

    return variants.map((v) => ({
      ...v,
      available: Math.max(0, (v.stock || 0) - (v.reservedStock || 0)),
    }));
  }
}

const __exports: any = new ProductService();

export default __exports;
