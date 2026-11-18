// @ts-nocheck — ported from the Express backend (services/webhookService.js); logic unchanged.
import __imp0 from "@/server/config/logger";
import __imp1 from "@/server/models/productModel";
import __imp2 from "@/server/models/collectionModel";
import __imp3 from "@/server/models/variantModel";
import __imp4 from "@/server/utils/slugify";

const logger = __imp0;
const Product = __imp1;
const Collection = __imp2;
const Variant = __imp3;
const { slugify } = __imp4;

/**
 * Shiprocket Product Webhook Service
 *
 * Handles product sync from Shiprocket's merchant system:
 * - Create/update products with variants
 * - Sync inventory quantity
 * - Manage product metadata
 */
class WebhookService {
  /**
   * Process incoming product webhook
   * @param {Object} payload - Webhook payload from Shiprocket
   * @returns {Promise<Object>} Created/updated product
   */
  static async handleProductWebhook(payload) {
    const { id, title, body_html, vendor, product_type, handle, variants, status, tags } = payload;

    if (!id || !title) {
      throw new Error('Product webhook missing required fields: id, title');
    }

    try {
      // Generate slug from handle or title
      const slug = handle ? handle.toLowerCase() : slugify(title);

      // Check if product exists
      let product = await Product.findOne({ externalShiprocketId: id });

      if (product) {
        // Update existing product
        logger.info(`Updating product: ${id} - ${title}`);
        product.title = title;
        product.slug = slug;
        product.shortDescription = this.extractShortDescription(body_html);
        product.description = body_html;
        product.brand = vendor;
        product.status = status === 'active' ? 'published' : 'draft';

        if (tags) {
          product.tags = tags.split(',').map(t => t.trim());
        }

        await product.save();
      } else {
        // Create new product
        logger.info(`Creating new product: ${id} - ${title}`);
        product = await Product.create({
          externalShiprocketId: id,
          title,
          slug,
          shortDescription: this.extractShortDescription(body_html),
          description: body_html,
          brand: vendor,
          basePrice: 0, // Default, should be updated via admin
          status: status === 'active' ? 'published' : 'draft',
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
        });
      }

      // Process variants
      if (variants && Array.isArray(variants) && variants.length > 0) {
        await this.syncVariants(product._id, variants);
      }

      logger.info(`Product webhook processed successfully: ${product._id}`);
      return product;
    } catch (error) {
      logger.error(`Error processing product webhook: ${error.message}`, { payload });
      throw error;
    }
  }

  /**
   * Process incoming collection webhook
   * @param {Object} payload - Webhook payload from Shiprocket
   * @returns {Promise<Object>} Created/updated collection
   */
  static async handleCollectionWebhook(payload) {
    const { id, title, handle, body_html, image, created_at, updated_at } = payload;

    if (!id || !title) {
      throw new Error('Collection webhook missing required fields: id, title');
    }

    try {
      // Generate slug from handle or title
      const slug = handle ? handle.toLowerCase() : slugify(title);

      // Check if collection exists
      let collection = await Collection.findOne({ externalShiprocketId: id });

      if (collection) {
        // Update existing collection
        logger.info(`Updating collection: ${id} - ${title}`);
        collection.name = title;
        collection.slug = slug;
        collection.description = body_html;

        if (image && image.src) {
          collection.imageUrl = image.src;
        }

        await collection.save();
      } else {
        // Create new collection
        logger.info(`Creating new collection: ${id} - ${title}`);
        collection = await Collection.create({
          externalShiprocketId: id,
          name: title,
          slug,
          description: body_html,
          type: 'manual', // Default type
          imageUrl: image?.src || null,
          createdAt: created_at ? new Date(created_at) : new Date(),
        });
      }

      logger.info(`Collection webhook processed successfully: ${collection._id}`);
      return collection;
    } catch (error) {
      logger.error(`Error processing collection webhook: ${error.message}`, { payload });
      throw error;
    }
  }

  /**
   * Sync product variants
   * @private
   */
  static async syncVariants(productId, variants) {
    for (const variantData of variants) {
      try {
        const { id, title, price, sku, quantity, image, weight, weight_unit, option_values } = variantData;

        if (!id || !sku) {
          logger.warn(`Skipping variant without id or sku:`, variantData);
          continue;
        }

        let variant = await Variant.findOne({ externalShiprocketId: id });

        if (variant) {
          // Update existing variant
          variant.title = title;
          variant.price = parseFloat(price) || 0;
          variant.sku = sku;
          variant.inventory = {
            quantity: parseInt(quantity) || 0,
          };

          if (weight) {
            variant.weight = parseFloat(weight);
            variant.weightUnit = weight_unit || 'kg';
          }

          if (image && image.src) {
            variant.images = [{
              url: image.src,
              role: 'primary',
            }];
          }

          if (option_values && typeof option_values === 'object') {
            variant.optionValues = option_values;
          }

          await variant.save();
        } else {
          // Create new variant
          const variantPayload = {
            externalShiprocketId: id,
            productId,
            title,
            price: parseFloat(price) || 0,
            sku,
            inventory: {
              quantity: parseInt(quantity) || 0,
            },
          };

          if (weight) {
            variantPayload.weight = parseFloat(weight);
            variantPayload.weightUnit = weight_unit || 'kg';
          }

          if (image && image.src) {
            variantPayload.images = [{
              url: image.src,
              role: 'primary',
            }];
          }

          if (option_values && typeof option_values === 'object') {
            variantPayload.optionValues = option_values;
          }

          await Variant.create(variantPayload);
        }

        logger.info(`Variant synced: ${sku}`);
      } catch (error) {
        logger.error(`Error syncing variant: ${error.message}`, { variant: variantData });
        // Continue with next variant
      }
    }
  }

  /**
   * Extract short description from HTML body
   * @private
   */
  static extractShortDescription(htmlBody) {
    if (!htmlBody) return null;

    // Remove HTML tags
    const text = htmlBody.replace(/<[^>]*>/g, '');

    // Truncate to 300 chars
    return text.substring(0, 300).trim();
  }
}

const __exports: any = WebhookService;

export default __exports;
