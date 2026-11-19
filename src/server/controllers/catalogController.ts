// @ts-nocheck — ported from the Express backend (controllers/catalogController.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/config/logger";
import { formatCatalogCollection, formatCatalogProducts } from "@/server/services/shiprocketCatalog";

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

      // Shiprocket catalog format, with each product's sizes (shared with the automatic sync).
      const formattedProducts = await formatCatalogProducts(products);

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

      // Shiprocket format (shared with the automatic collection sync)
      const formattedCollections = collections.map(formatCatalogCollection);

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
