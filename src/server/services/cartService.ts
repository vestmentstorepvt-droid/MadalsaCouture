// @ts-nocheck — ported from the Express backend (services/cartService.js); logic unchanged.
import __imp0 from "@/server/models/cartModel";
import __imp1 from "@/server/models/productModel";
import __imp2 from "@/server/models/variantModel";

const Cart = __imp0;
const Product = __imp1;
const Variant = __imp2;

function createError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code: code || 'REQUEST_ERROR' });
}

class CartService {
  /**
   * Helper to format image URL from product/variant
   */
  getImageUrl(images) {
    if (!Array.isArray(images) || images.length === 0) return '';
    const first = images.find((img) => img && typeof img === 'object' && img.role === 'primary') || images[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && first.url) return first.url;
    return '';
  }

  /**
   * Calculate totals and populate cart item details
   */
  async formatCartResponse(cartDoc) {
    if (!cartDoc) return null;

    // Populate products and variants
    await cartDoc.populate([
      {
        path: 'items.productId',
        select: 'title name slug basePrice mrp images status isDeleted'
      },
      {
        path: 'items.variantId',
        select: 'size color sku price mrp stockQuantity images isDeleted'
      }
    ]);

    let subtotal = 0;
    let totalItems = 0;
    const formattedItems = [];

    for (const item of cartDoc.items) {
      const product = item.productId;
      if (!product || product.isDeleted || product.status === 'draft') continue;

      const variant = item.variantId;
      const unitPrice = variant?.price ?? product.basePrice ?? item.price ?? 0;
      const lineTotal = unitPrice * item.quantity;
      const image = this.getImageUrl(variant?.images) || this.getImageUrl(product.images);

      subtotal += lineTotal;
      totalItems += item.quantity;

      formattedItems.push({
        _id: item._id,
        productId: {
          _id: product._id,
          title: product.title || product.name,
          name: product.title || product.name,
          slug: product.slug,
          images: product.images,
          basePrice: product.basePrice,
          mrp: product.mrp
        },
        variantId: variant
          ? {
              _id: variant._id,
              size: variant.size,
              color: variant.color,
              sku: variant.sku,
              price: variant.price,
              mrp: variant.mrp,
              stockQuantity: variant.stockQuantity
            }
          : null,
        name: product.title || product.name,
        image,
        size: item.selectedSize || variant?.size,
        color: item.selectedColor || variant?.color,
        price: unitPrice,
        unitPrice,
        quantity: item.quantity,
        lineTotal
      });
    }

    cartDoc.subtotal = subtotal;
    cartDoc.totalItems = totalItems;
    await cartDoc.save();

    return {
      _id: cartDoc._id,
      user: cartDoc.user,
      items: formattedItems,
      subtotal,
      totalItems,
      createdAt: cartDoc.createdAt,
      updatedAt: cartDoc.updatedAt
    };
  }

  /**
   * Get user's cart or create an empty cart if not exists
   */
  async getCart(userId) {
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }
    return this.formatCartResponse(cart);
  }

  /**
   * Add item to cart
   */
  async addToCart(userId, {
    productId,
    variantId,
    quantity = 1,
    selectedSize = '',
    selectedColor = '',
  }) {
    if (!productId) {
      throw createError('productId is required', 400, 'INVALID_INPUT');
    }

    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
      throw createError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    let unitPrice = product.basePrice || 0;
    let variant;
    if (variantId) {
      variant = await Variant.findById(variantId);
      if (!variant || variant.isDeleted) {
        throw createError('Variant not found', 404, 'VARIANT_NOT_FOUND');
      }
      unitPrice = variant.price || unitPrice;
    }
    if (selectedSize && variant && (variant.size || '').trim().toUpperCase() !== selectedSize.trim().toUpperCase()) {
      throw createError('Selected size is not available for this variant', 400, 'INVALID_SIZE');
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = Cart.build({ user: userId, items: [] });
    }

    // Check existing item in cart
    const existingIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId.toString() &&
        (variantId ? item.variantId?.toString() === variantId.toString() : !item.variantId) &&
        (item.selectedSize || '') === selectedSize &&
        (item.selectedColor || '') === selectedColor
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += Number(quantity);
      cart.items[existingIndex].price = unitPrice;
    } else {
      cart.items.push({
        productId,
        variantId: variantId || null,
        selectedSize,
        selectedColor,
        quantity: Number(quantity),
        price: unitPrice
      });
    }

    await cart.save();
    return this.formatCartResponse(cart);
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(userId, itemId, quantity) {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw createError('Cart not found', 404, 'CART_NOT_FOUND');
    }

    // Match by _id, or by productId/variantId match
    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === itemId || item.productId.toString() === itemId
    );

    if (itemIndex === -1) {
      throw createError('Cart item not found', 404, 'ITEM_NOT_FOUND');
    }

    if (quantity < 1) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = Number(quantity);
    }

    await cart.save();
    return this.formatCartResponse(cart);
  }

  /**
   * Remove item from cart
   */
  async removeCartItem(userId, itemId) {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw createError('Cart not found', 404, 'CART_NOT_FOUND');
    }

    cart.items = cart.items.filter(
      (item) => item._id.toString() !== itemId && item.productId.toString() !== itemId
    );

    await cart.save();
    return this.formatCartResponse(cart);
  }

  /**
   * Take ordered items out of the cart once an order is placed: each ordered size is removed, or
   * its quantity reduced if the cart holds more than was ordered. Anything else stays.
   *
   * @param {string} userId
   * @param {{ variantId: string, quantity: number }[]} ordered
   */
  async removeOrderedItems(userId, ordered = []) {
    const cart = await Cart.findOne({ user: userId });
    if (!cart || !cart.items?.length) return cart ? this.formatCartResponse(cart) : null;

    const remaining = new Map();
    for (const o of ordered) {
      if (!o?.variantId) continue;
      const key = String(o.variantId);
      remaining.set(key, (remaining.get(key) || 0) + Math.max(1, Number(o.quantity) || 1));
    }
    if (!remaining.size) return this.formatCartResponse(cart);

    const kept = [];
    for (const item of cart.items) {
      const key = item.variantId ? String(item.variantId._id || item.variantId) : null;
      const left = key ? remaining.get(key) || 0 : 0;
      if (!left) {
        kept.push(item);
        continue;
      }
      if (item.quantity > left) {
        item.quantity -= left;
        remaining.set(key, 0);
        kept.push(item);
      } else {
        remaining.set(key, left - item.quantity);
      }
    }
    cart.items = kept;
    await cart.save();
    return this.formatCartResponse(cart);
  }

  /**
   * Clear all items from cart
   */
  async clearCart(userId) {
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = Cart.build({ user: userId, items: [] });
    } else {
      cart.items = [];
    }

    await cart.save();
    return this.formatCartResponse(cart);
  }

  /**
   * Bulk sync local guest cart items to backend cart on login
   */
  async syncCart(userId, guestItems = []) {
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = Cart.build({ user: userId, items: [] });
    }

    if (Array.isArray(guestItems)) {
      for (const gItem of guestItems) {
        if (!gItem.productId) continue;

        const existingIndex = cart.items.findIndex(
          (item) =>
            item.productId.toString() === gItem.productId.toString() &&
            (gItem.variantId ? item.variantId?.toString() === gItem.variantId.toString() : !item.variantId) &&
            (item.selectedSize || '') === (gItem.selectedSize || gItem.size || '') &&
            (item.selectedColor || '') === (gItem.selectedColor || gItem.color || '')
        );

        if (existingIndex > -1) {
          cart.items[existingIndex].quantity = Math.max(
            cart.items[existingIndex].quantity,
            Number(gItem.quantity || 1)
          );
        } else {
          cart.items.push({
            productId: gItem.productId,
            variantId: gItem.variantId || null,
            selectedSize: gItem.selectedSize || gItem.size || '',
            selectedColor: gItem.selectedColor || gItem.color || '',
            quantity: Number(gItem.quantity || 1),
            price: gItem.price || 0
          });
        }
      }
    }

    await cart.save();
    return this.formatCartResponse(cart);
  }
}

const __exports: any = new CartService();

export default __exports;
