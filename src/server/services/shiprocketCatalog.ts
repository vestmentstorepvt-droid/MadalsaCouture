// @ts-nocheck — same loose typing as the ported catalog controller it was extracted from.
import crypto from "node:crypto";
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/config/logger";

const mongoose = __imp0;
const logger = __imp1;

/**
 * Shiprocket Checkout catalog.
 *
 * Shiprocket Checkout only knows the products a custom site sends it. If a cart holds a product
 * it doesn't know, its checkout window fails ("Something went wrong"). So:
 *  - `formatCatalogProducts` builds the product shape Shiprocket expects (also served by the
 *    /api/fastrr/products feed, so both always match);
 *  - `queueShiprocketSync(productId)` sends one product's current state after every admin change.
 *    A deleted or unpublished product is sent as inactive with no stock, so it can't be bought.
 */

const SHIPROCKET_PRODUCT_WEBHOOK = "https://checkout-api.shiprocket.com/wh/v1/custom/product";

/** The numeric id Shiprocket uses for a variant (checkout sends the same one; see shiprocketCheckoutController). */
export const shiprocketVariantId = (variantId) => parseInt(String(variantId).slice(-8), 16);

const imageSrc = (raw) => (raw ? (typeof raw === "string" ? raw : raw.url) : null);

/** Products (lean docs) → Shiprocket catalog products, with their sizes from the Variant collection. */
export async function formatCatalogProducts(products) {
  // Sizes live in the Variant collection (products don't embed them). Without these, Shiprocket
  // got every product with zero variants and its checkout couldn't load any cart.
  const Variant = mongoose.models.Variant || mongoose.model("Variant");
  const productIds = products.map((p) => p._id);
  const variantRows = productIds.length
    ? await Variant.find({ productId: { $in: productIds }, isDeleted: false }).lean()
    : [];
  const variantsByProduct = new Map();
  for (const v of variantRows) {
    const key = String(v.productId);
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
    variantsByProduct.get(key).push(v);
  }
  const variantsOf = (product) => variantsByProduct.get(String(product._id)) || product.variants || [];

  return products.map((product) => {
    const variants = variantsOf(product);

    // Options from the variants' attribute values
    const optionMap = {};
    for (const v of variants) {
      if (v.color) (optionMap.Color = optionMap.Color || new Set()).add(v.color);
      if (v.size) (optionMap.Size = optionMap.Size || new Set()).add(v.size);
      if (v.fabric) (optionMap.Fabric = optionMap.Fabric || new Set()).add(v.fabric);
    }
    const options = Object.entries(optionMap).map(([name, valSet]) => ({ name, values: [...valSet] }));

    // Tags as a comma-separated string from product flags
    const tagParts = [];
    if (product.flags?.isFeatured) tagParts.push("Featured");
    if (product.flags?.isNewArrival) tagParts.push("New Arrival");
    if (product.flags?.isBestSeller) tagParts.push("Best Seller");
    if (product.flags?.isTrending) tagParts.push("Trending");
    if (product.flags?.isMadeToOrder) tagParts.push("Made To Order");
    if (product.flags?.isReadyToShip !== false) tagParts.push("Ready To Ship");

    const primary = imageSrc((product.images || [])[0]);
    const image = primary ? { src: primary } : null;

    // Published and not deleted → active; anything else → inactive
    const status = product.status === "published" && !product.isDeleted ? "active" : "inactive";

    // Numeric id: externalShiprocketId when set, else derived from the ObjectId
    const numericId = product.externalShiprocketId
      ? Number(product.externalShiprocketId)
      : parseInt(product._id.toString().slice(-8), 16);

    return {
      id: numericId,
      title: product.title,
      body_html: product.description,
      vendor: "Madalsa Couture",
      product_type: "Fashion",
      created_at: product.createdAt ? new Date(product.createdAt).toISOString() : new Date().toISOString(),
      handle: (product.title || "product").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      updated_at: product.updatedAt ? new Date(product.updatedAt).toISOString() : new Date().toISOString(),
      tags: tagParts.join(", "),
      status,
      image,
      options,
      variants: variants.map((variant, idx) => {
        const variantImage = imageSrc((variant.images || [])[0]);
        return {
          id: variant._id ? shiprocketVariantId(variant._id) : idx,
          title: [variant.size, variant.color].filter(Boolean).join(" / ") || "Default Title",
          price: String(variant.price ?? product.basePrice ?? "0.00"),
          compare_at_price: String(product.mrp ?? variant.price ?? "0.00"),
          sku: variant.sku,
          // Same rule as the shop's stock check: stock minus what open orders have reserved.
          // An inactive product is sent with no stock so it can't be bought.
          quantity:
            status === "active"
              ? (variant.availableStock ?? Math.max(0, (variant.stock ?? 0) - (variant.reservedStock ?? 0)))
              : 0,
          taxable: true,
          option_values: {
            ...(variant.color ? { Color: variant.color } : {}),
            ...(variant.size ? { Size: variant.size } : {}),
            ...(variant.fabric ? { Fabric: variant.fabric } : {}),
          },
          grams: null,
          image: variantImage ? { src: variantImage } : image,
          weight: null,
          weight_unit: "kg",
        };
      }),
    };
  });
}

/** Send one product's current state (including deleted/unpublished) to Shiprocket. */
export async function syncProductToShiprocket(productId) {
  const apiKey = (process.env.SHIPROCKET_API_KEY || "").trim();
  const secret = (process.env.SHIPROCKET_SECRET_KEY || "").trim();
  if (!apiKey || !secret) return; // Shiprocket not configured
  // Only the live server syncs: a laptop with the real keys in .env.local must not overwrite the
  // live Shiprocket catalog with local test data. SHIPROCKET_SYNC=on forces it, =off disables it.
  const flag = (process.env.SHIPROCKET_SYNC || "").trim().toLowerCase();
  if (flag === "off" || (flag !== "on" && process.env.NODE_ENV !== "production")) return;

  const Product = mongoose.models.Product || mongoose.model("Product");
  const product = await Product.findById(productId).lean();
  if (!product) return;

  const [payload] = await formatCatalogProducts([product]);
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const res = await fetch(SHIPROCKET_PRODUCT_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey, "X-Api-HMAC-SHA256": signature },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok || !/"ok"\s*:\s*true/.test(text)) {
    throw new Error(`Shiprocket rejected product ${productId}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  logger.info(`[Shiprocket] Synced product ${productId} (${payload.status}, ${payload.variants.length} sizes)`);
}

// Several saves in a row (product, then each size) collapse into one send per product.
const pending = new Map();

/** Send a product to Shiprocket shortly after an admin change. Never throws; failures are logged. */
export function queueShiprocketSync(productId) {
  if (!productId) return;
  const key = String(productId);
  clearTimeout(pending.get(key));
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      syncProductToShiprocket(key).catch((err) => logger.error(`[Shiprocket] Product sync failed: ${err.message}`));
    }, 1500),
  );
}
