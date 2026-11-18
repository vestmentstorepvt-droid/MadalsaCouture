// @ts-nocheck — ported from the Express backend (routes/catalogRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/catalogController";

const express = __imp0;
const catalogController = __imp1;

/**
 * Catalog Routes — mounted at /shiprocket
 *
 * Seller-implemented endpoints that Shiprocket pulls to sync catalog data.
 * No authentication required (Shiprocket reads these).
 *
 * GET /shiprocket/products                     — all products (paginated)
 * GET /shiprocket/products?collection_id=X     — products filtered by collection
 * GET /shiprocket/collections                  — all collections (paginated)
 */

const router = express.Router();

router.get('/products', (req, res, next) => catalogController.fetchProducts(req, res, next));

router.get('/collections', (req, res, next) => catalogController.fetchCollections(req, res, next));

const __exports: any = router;

export default __exports;
