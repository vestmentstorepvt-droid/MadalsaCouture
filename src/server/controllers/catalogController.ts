// @ts-nocheck — ported from the Express backend (controllers/catalogController.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/config/logger";

const mongoose = __imp0;
const logger = __imp1;

/**
 * Catalog Controller — Fastrr-compatible catalog APIs
 *
 * These endpoints provide product and collection data in the format
 * expected by external catalog systems like Fastrr.
 */

class CatalogController {
  /**
   * GET /api/fastrr/products
   * Fetch all products with pagination
   *
   * Query params:
   *   page (default: 1)
   *   limit (default: 100)
   *   collection_id (optional, to filter by collection)
   */
  async fetchProducts(req, res, next) {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(1000, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
      const collectionId = req.query.collection_id;

      const Product = mongoose.models.Product || mongoose.model('Product');

      // Build filter
      const filter = { status: 'published', isDeleted: false };
      if (collectionId) {
        try {
          if (mongoose.Types.ObjectId.isValid(collectionId)) {
            // collectionIds is an array, so use $in operator
            filter.collectionIds = { $in: [new mongoose.Types.ObjectId(collectionId)] };
          } else {
            // If not a valid ObjectId, still filter by the string (may not match anything)
            logger.warn(`[CatalogController] Invalid collection_id format: ${collectionId}`);
          }
        } catch (err) {
          logger.error(`[CatalogController] Error parsing collection_id: ${err.message}`);
        }
      }

      // Fetch total count and products
      const total = await Product.countDocuments(filter);
      const products = await Product.find(filter)
        .select('_id title shortDescription description basePrice mrp sku variants images status createdAt updatedAt designer brand gender ageGroup season occasions categoryId subcategoryId collectionIds flags')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Note: collectionIds, categoryId, subcategoryId are ObjectIds in the response
      // To get full names, you would need to populate them separately

      // Transform to Shiprocket / Fastrr catalog format
      const formattedProducts = products.map(product => {
        // Derive options from unique variant attribute values
        const optionMap = {};
        for (const v of (product.variants || [])) {
          if (v.color) { (optionMap.Color = optionMap.Color || new Set()).add(v.color); }
          if (v.size) { (optionMap.Size = optionMap.Size || new Set()).add(v.size); }
          if (v.fabric) { (optionMap.Fabric = optionMap.Fabric || new Set()).add(v.fabric); }
        }
        const options = Object.entries(optionMap).map(([name, valSet]) => ({
          name,
          values: [...valSet],
        }));

        // Tags as comma-separated string from product flags
        const tagParts = [];
        if (product.flags?.isFeatured) tagParts.push('Featured');
        if (product.flags?.isNewArrival) tagParts.push('New Arrival');
        if (product.flags?.isBestSeller) tagParts.push('Best Seller');
        if (product.flags?.isTrending) tagParts.push('Trending');
        if (product.flags?.isMadeToOrder) tagParts.push('Made To Order');
        if (product.flags?.isReadyToShip !== false) tagParts.push('Ready To Ship');
        const tags = tagParts.join(', ');

        // Primary image as single {src} object
        const rawPrimaryImg = (product.images || [])[0];
        const primaryImageSrc = rawPrimaryImg
          ? (typeof rawPrimaryImg === 'string' ? rawPrimaryImg : rawPrimaryImg.url)
          : null;
        const image = primaryImageSrc ? { src: primaryImageSrc } : null;

        // Status: published → active, anything else → inactive
        const status = product.status === 'published' ? 'active' : 'inactive';

        // Numeric id: use externalShiprocketId when available, else derive from ObjectId
        const numericId = product.externalShiprocketId
          ? Number(product.externalShiprocketId)
          : parseInt(product._id.toString().slice(-8), 16);

        return {
          id: numericId,
          title: product.title,
          body_html: product.description,
          vendor: 'Madalsa Couture',
          product_type: 'Fashion',
          created_at: product.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
          handle: (product.title || 'product').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          updated_at: product.updatedAt ? new Date(product.updatedAt).toISOString() : new Date().toISOString(),
          tags,
          status,
          image,
          options,
          variants: (product.variants || []).map((variant, idx) => {
            const rawVarImg = (variant.images || [])[0];
            const variantImageSrc = rawVarImg
              ? (typeof rawVarImg === 'string' ? rawVarImg : rawVarImg.url)
              : null;
            const variantNumericId = variant._id
              ? parseInt(variant._id.toString().slice(-8), 16)
              : idx;
            return {
              id: variantNumericId,
              title: [variant.size, variant.color].filter(Boolean).join(' / ') || 'Default Title',
              price: String(variant.price ?? product.basePrice ?? '0.00'),
              compare_at_price: String(product.mrp ?? variant.price ?? '0.00'),
              sku: variant.sku,
              quantity: variant.availableStock ?? 0,
              taxable: true,
              option_values: {
                ...(variant.color ? { Color: variant.color } : {}),
                ...(variant.size ? { Size: variant.size } : {}),
                ...(variant.fabric ? { Fabric: variant.fabric } : {}),
              },
              grams: null,
              image: variantImageSrc ? { src: variantImageSrc } : image,
              weight: null,
              weight_unit: 'kg',
            };
          }),
        };
      });

      res.status(200).json({
        data: {
          total,
          products: formattedProducts
        }
      });
    } catch (error) {
      logger.error(`[CatalogController] fetchProducts error: ${error.message}`);
      next(error);
    }
  }

  /**
   * GET /api/fastrr/collections
   * Fetch all collections with pagination
   *
   * Query params:
   *   page (default: 1)
   *   limit (default: 100)
   */
  async fetchCollections(req, res, next) {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(1000, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));

      const Collection = mongoose.models.Collection || mongoose.model('Collection');

      // Build filter for active collections
      const filter = { status: 'active', isDeleted: false };

      // Fetch total count and collections
      const total = await Collection.countDocuments(filter);
      const collections = await Collection.find(filter)
        .select('_id name description image status')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Transform to Shiprocket format
      const formattedCollections = collections.map(collection => ({
        id: collection._id.toString(),
        title: collection.name || collection.title,
        body_html: collection.description,
        handle: (collection.name || collection.title || 'collection').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        updated_at: collection.updatedAt ? new Date(collection.updatedAt).toISOString() : new Date().toISOString(),
        image: collection.image
          ? { src: typeof collection.image === 'string' ? collection.image : collection.image.src || collection.image.url }
          : null
      }));

      res.status(200).json({
        data: {
          total,
          collections: formattedCollections
        }
      });
    } catch (error) {
      logger.error(`[CatalogController] fetchCollections error: ${error.message}`);
      next(error);
    }
  }

  /**
   * GET /api/fastrr/products?collection_id=xxx
   * Fetch products filtered by collection
   *
   * Query params:
   *   collection_id (required)
   *   page (default: 1)
   *   limit (default: 100)
   *
   * Note: This is the same as fetchProducts with collection_id filter
   * Use /api/fastrr/products?collection_id=xxx directly instead
   */
  async fetchProductsByCollection(req, res, next) {
    const collectionId = req.query.collection_id;

    if (!collectionId) {
      return res.status(400).json({
        error: 'collection_id is required'
      });
    }

    // Delegate to fetchProducts with collection_id filter
    return this.fetchProducts(req, res, next);
  }
}

const __exports: any = new CatalogController();

export default __exports;
