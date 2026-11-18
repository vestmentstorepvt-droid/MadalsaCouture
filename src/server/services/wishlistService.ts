// @ts-nocheck — ported from the Express backend (services/wishlistService.js); logic unchanged.
import __imp0 from "@/server/models/userModel";
import __imp1 from "@/server/models/productModel";
import __imp2 from "@/server/models/variantModel";

const User = __imp0;
const Product = __imp1;
const Variant = __imp2;

/**
 * Build a standardised service error.
 *
 * @param {string} message    - Human-readable message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} [code]     - SNAKE_CASE error code sent in the JSON response.
 * @returns {Error}
 */
function createError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code: code || 'REQUEST_ERROR' });
}

class WishlistService {
  /**
   * Add a product to the user's wishlist (idempotent — $addToSet prevents duplicates).
   *
   * @param {string|ObjectId} userId    - The authenticated user's ObjectId.
   * @param {string|ObjectId} productId - The product to add.
   * @returns {Promise<ObjectId[]>} The updated wishlist array of product ObjectIds.
   */
  async addToWishlist(userId, productId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { wishlist: productId } },
      { new: true, select: 'wishlist' }
    );

    if (!user) {
      throw createError('User not found.', 404, 'USER_NOT_FOUND');
    }

    return user.wishlist;
  }

  /**
   * Remove a product from the user's wishlist.
   *
   * @param {string|ObjectId} userId    - The authenticated user's ObjectId.
   * @param {string|ObjectId} productId - The product to remove.
   * @returns {Promise<ObjectId[]>} The updated wishlist array of product ObjectIds.
   */
  async removeFromWishlist(userId, productId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { wishlist: productId } },
      { new: true, select: 'wishlist' }
    );

    if (!user) {
      throw createError('User not found.', 404, 'USER_NOT_FOUND');
    }

    return user.wishlist;
  }

  /**
   * Get the user's wishlist with populated product details.
   *
   * Resolves each wishlist product ID against the Product collection,
   * excluding soft-deleted or non-published products. For each product,
   * the primary image is taken from the first non-deleted variant's first
   * image URL (Variant.images[0]).
   *
   * @param {string|ObjectId} userId - The authenticated user's ObjectId.
   * @returns {Promise<Object[]>} Array of wishlist product objects:
   *   { _id, title, slug, basePrice, primaryImage }
   */
  async getWishlist(userId) {
    // 1. Fetch the user's wishlist array of product ObjectIds
    const user = await User.findById(userId).select('wishlist');
    if (!user) {
      throw createError('User not found.', 404, 'USER_NOT_FOUND');
    }

    if (!user.wishlist || user.wishlist.length === 0) {
      return [];
    }

    // 2. Query Product collection — only published, non-soft-deleted products
    const products = await Product.find(
      {
        _id: { $in: user.wishlist },
        isDeleted: false,
        status: 'published'
      },
      { title: 1, slug: 1, basePrice: 1, images: 1 }
    ).lean();

    if (products.length === 0) {
      return [];
    }

    // 3. Fetch variant images fallback
    const productIds = products.map((p) => p._id);

    const variantImages = await Variant.aggregate([
      {
        $match: {
          productId: { $in: productIds },
          isDeleted: false,
          'images.0': { $exists: true } // only variants that have at least one image
        }
      },
      {
        $sort: { createdAt: 1 } // deterministic ordering — pick oldest variant first
      },
      {
        $group: {
          _id: '$productId',
          primaryImage: { $first: { $arrayElemAt: ['$images', 0] } }
        }
      }
    ]);

    // Build a lookup map: productId string → primaryImage URL
    const variantImageMap = Object.fromEntries(
      variantImages.map((v) => [v._id.toString(), v.primaryImage])
    );

    // 4. Assemble and return the enriched wishlist items
    return products.map((product) => {
      let imageStr = null;
      if (Array.isArray(product.images) && product.images.length > 0) {
        const first = product.images.find((img) => img.role === 'primary') || product.images[0];
        imageStr = typeof first === 'string' ? first : (first?.url || null);
      }
      if (!imageStr && variantImageMap[product._id.toString()]) {
        const vImg = variantImageMap[product._id.toString()];
        imageStr = typeof vImg === 'string' ? vImg : (vImg?.url || null);
      }

      return {
        _id: product._id,
        title: product.title,
        slug: product.slug,
        basePrice: product.basePrice,
        primaryImage: imageStr
      };
    });

  }
}

const __exports: any = new WishlistService();

export default __exports;
