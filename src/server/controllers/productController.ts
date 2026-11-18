// @ts-nocheck — ported from the Express backend (controllers/productController.js); logic unchanged.
import __imp0 from "@/server/services/productService";
import __imp1 from "@/server/utils/response";

const productService = __imp0;
const { sendSuccess } = __imp1;

function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  let sort = { createdAt: -1 };
  if (query.sort) {
    const [field, direction] = String(query.sort).split(':');
    if (field) sort = { [field]: direction === 'asc' ? 1 : -1 };
  }

  return { page, limit, sort };
}

/**
 * Extract all supported filter params from req.query.
 * Works for both admin (any status) and public (status locked to 'published').
 */
function parseFilters(query, defaults = {}) {
  const filters = { ...defaults };

  const {
    status, categoryId, subcategoryId, collectionIds, tagIds,
    minPrice, maxPrice, search,
    gender, ageGroup, designer, brand, season, occasions,
    isFeatured, isNewArrival, isBestSeller, isTrending,
    isLimitedEdition, isPreOrder, isReadyToShip, isMadeToOrder,
  } = query;

  if (status && !defaults.status)  filters.status        = status;
  if (categoryId)                  filters.categoryId    = categoryId;
  if (subcategoryId)               filters.subcategoryId = subcategoryId;
  if (collectionIds)               filters.collectionIds = collectionIds;
  if (tagIds)                      filters.tagIds        = tagIds;
  if (minPrice)                    filters.minPrice      = minPrice;
  if (maxPrice)                    filters.maxPrice      = maxPrice;
  if (search)                      filters.search        = search;

  if (gender)    filters.gender    = gender;
  if (ageGroup)  filters.ageGroup  = ageGroup;
  if (designer)  filters.designer  = designer;
  if (brand)     filters.brand     = brand;
  if (season)    filters.season    = season;
  if (occasions) filters.occasions = occasions;

  // Boolean flags — accept 'true' string from query params
  if (isFeatured)      filters.isFeatured      = isFeatured;
  if (isNewArrival)    filters.isNewArrival    = isNewArrival;
  if (isBestSeller)    filters.isBestSeller    = isBestSeller;
  if (isTrending)      filters.isTrending      = isTrending;
  if (isLimitedEdition) filters.isLimitedEdition = isLimitedEdition;
  if (isPreOrder)      filters.isPreOrder      = isPreOrder;
  if (isReadyToShip)   filters.isReadyToShip   = isReadyToShip;
  if (isMadeToOrder)   filters.isMadeToOrder   = isMadeToOrder;

  return filters;
}

class ProductController {
  // ── Admin endpoints ────────────────────────────────────────────────────────

  /** POST /api/v1/admin/products */
  async createProduct(req, res, next) {
    try {
      const product = await productService.createProduct(req.body, req.user.id);
      return sendSuccess(res, { product }, 201);
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/v1/admin/products/:id */
  async updateProduct(req, res, next) {
    try {
      const product = await productService.updateProduct(req.params.id, req.body, req.user.id);
      return sendSuccess(res, { product });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/v1/admin/products/:id/status */
  async updateProductStatus(req, res, next) {
    try {
      const product = await productService.updateProductStatus(req.params.id, req.body.status, req.user.id);
      return sendSuccess(res, { product });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/v1/admin/products/:id */
  async deleteProduct(req, res, next) {
    try {
      const product = await productService.softDeleteProduct(req.params.id, req.user.id);
      return sendSuccess(res, { product });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/admin/products/:id */
  async adminGetProduct(req, res, next) {
    try {
      const product = await productService.getProductById(req.params.id);
      return sendSuccess(res, { product });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/admin/products */
  async adminListProducts(req, res, next) {
    try {
      const pagination = parsePagination(req.query);
      const filters    = parseFilters(req.query, { isDeleted: false });
      const result     = await productService.listProducts(filters, pagination);
      return sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  // ── Public endpoints ───────────────────────────────────────────────────────

  /**
   * GET /api/v1/products/:slug
   * One-stop product detail API.
   * Returns product + category + subcategory + tags + variants + related +
   *         discountPercent + breadcrumb.
   * Internal fields (createdBy, updatedBy, isDeleted, deletedAt) are stripped.
   */
  async getProduct(req, res, next) {
    try {
      const product = await productService.getProductBySlug(req.params.slug);

      if (product.status !== 'published') {
        return next(Object.assign(new Error('Product not found.'), { statusCode: 404 }));
      }

      return sendSuccess(res, { product });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/products */
  async listProducts(req, res, next) {
    try {
      const pagination = parsePagination(req.query);
      // Public: always published + not deleted
      const filters = parseFilters(req.query, { status: 'published', isDeleted: false });
      const result  = await productService.listProducts(filters, pagination);
      return sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new ProductController();

export default __exports;
