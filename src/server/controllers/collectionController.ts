// @ts-nocheck — ported from the Express backend (controllers/collectionController.js); logic unchanged.
import __imp0 from "@/server/services/collectionService";
import __imp1 from "@/server/utils/response";

const collectionService = __imp0;
const { sendSuccess } = __imp1;


/**
 * Parse pagination/sort options from query params.
 *
 * Accepts: ?page=1&limit=20&sort=createdAt:desc
 *
 * @param {object} query - Express req.query
 * @returns {{ page: number, limit: number, sort: object }}
 */
function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  let sort = { createdAt: -1 };
  if (query.sort) {
    const [field, direction] = String(query.sort).split(':');
    if (field) {
      sort = { [field]: direction === 'asc' ? 1 : -1 };
    }
  }

  return { page, limit, sort };
}

class CollectionController {
  // ─── Admin endpoints ────────────────────────────────────────────────────────

  /**
   * POST /api/v1/admin/collections
   * Create a new collection. Slug is auto-generated from the name.
   */
  async createCollection(req, res, next) {
    try {
      const collection = await collectionService.createCollection(req.body, req.user.id);
      if (collection.status === 'active') {
        
      }
      return sendSuccess(res, { collection }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/collections/:id
   * Fetch a single collection by ObjectId (admin view — all statuses).
   */
  async getCollection(req, res, next) {
    try {
      const collection = await collectionService.getCollectionById(req.params.id);
      return sendSuccess(res, { collection });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/collections
   * Public listing of active collections — lightweight, for menus and navigation.
   * Returns: _id, name, slug, description, type, startsAt, endsAt only.
   */
  async listPublicCollections(req, res, next) {
    try {
      const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

      const result = await collectionService.listCollections(
        { status: 'active', isDeleted: false },
        { page, limit, sort: { name: 1 } }
      );

      // Return only storefront-safe fields
      const collections = result.data.map(c => ({
        _id:         c._id,
        name:        c.name,
        slug:        c.slug,
        description: c.description || null,
        type:        c.type,
        startsAt:    c.startsAt || null,
        endsAt:      c.endsAt   || null,
      }));

      return sendSuccess(res, { collections }, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/collections/:slug
   * Public endpoint — fetch by slug and attach resolved products.
   * Products include discountPercent and have internal fields stripped.
   */
  async getCollectionPublic(req, res, next) {
    try {
      const collection = await collectionService.getCollectionBySlug(req.params.slug);

      if (collection.status !== 'active') {
        return next(Object.assign(new Error('Collection not found.'), { statusCode: 404 }));
      }

      const rawProducts = await collectionService.resolveProducts(collection);

      // Add computed discountPercent to each product; strip internal fields
      const products = rawProducts.map(p => {
        const discountPercent = (p.mrp && p.mrp > p.basePrice)
          ? Math.round(((p.mrp - p.basePrice) / p.mrp) * 100)
          : 0;
        // eslint-disable-next-line no-unused-vars
        const { createdBy, updatedBy, isDeleted, deletedAt, ...safe } = p;
        return { ...safe, discountPercent };
      });

      // Strip internal fields from collection too
      // eslint-disable-next-line no-unused-vars
      const { createdBy, updatedBy, isDeleted, deletedAt, productIds, rules, ...safeCollection } = collection;

      return sendSuccess(res, { collection: { ...safeCollection, products } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/collections
   * List all collections for admin with optional filters and pagination.
   * Supports ?status=active|inactive&type=manual|rule-based&search=<text>
   */
  async listCollections(req, res, next) {
    try {
      const pagination = parsePagination(req.query);

      const filters = { isDeleted: false };

      const { status, type, search } = req.query;
      if (status) filters.status = status;
      if (type)   filters.type   = type;
      if (search) filters.search = search;

      const result = await collectionService.listCollections(filters, pagination);
      return sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/collections/:id
   * Update collection fields. Slug is regenerated when the name changes.
   */
  async updateCollection(req, res, next) {
    try {
      const collection = await collectionService.updateCollection(
        req.params.id,
        req.body,
        req.user.id
      );
      if (collection.status === 'active') {
        
      }
      return sendSuccess(res, { collection });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/collections/:id
   * Soft-delete a collection. Sets isDeleted: true.
   */
  async deleteCollection(req, res, next) {
    try {
      const collection = await collectionService.softDeleteCollection(
        req.params.id,
        req.user.id
      );
      return sendSuccess(res, { collection });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new CollectionController();

export default __exports;
