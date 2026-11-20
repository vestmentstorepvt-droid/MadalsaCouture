// @ts-nocheck — uses the Mongoose-compatible ODM like the rest of src/server.
//
// Storefront filters for GET /api/v1/products and GET /api/v1/products/facets.
// Collections hold their own productIds, and sizes/colours/stock live on
// variants, so these filters are resolved to a list of product ids that the
// product repository then applies with `_id: { $in }`.
import { Category, Collection, Product, Variant } from "@/server/models/registry";
import { COLOR_FAMILIES, OTHER_COLOR_FAMILY, colorFamilyOf, compareSizes } from "@/shared/shopFilters";

const list = (value) =>
  (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((v) => String(v).trim())
    .filter(Boolean);

const truthy = (value) => value === true || value === "true" || value === "1";

const available = (variant) => Math.max(0, (Number(variant.stock) || 0) - (Number(variant.reservedStock) || 0));

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseShopQuery(query = {}) {
  return {
    collections: list(query.collection),
    categories: list(query.categories),
    sizes: list(query.sizes).map((s) => s.toUpperCase()),
    colors: list(query.colors).map((c) => c.toLowerCase()),
    inStock: truthy(query.inStock),
    onSale: truthy(query.onSale),
  };
}

export function needsProductIdFilter(shop) {
  return Boolean(shop.collections.length || shop.categories.length || shop.sizes.length || shop.colors.length || shop.inStock);
}

async function activeCollections(filter = {}) {
  const now = Date.now();
  const rows = await Collection.find({ isDeleted: false, ...filter }).lean();
  return rows.filter(
    (c) =>
      (c.status ?? "active") === "active" &&
      (!c.startsAt || new Date(c.startsAt).getTime() <= now) &&
      (!c.endsAt || new Date(c.endsAt).getTime() >= now),
  );
}

async function collectionProductIds(slugs) {
  const ids = new Set();
  for (const collection of await activeCollections({ slug: { $in: slugs } })) {
    for (const id of collection.productIds || []) ids.add(String(id));
  }
  return ids;
}

/** Category ids for the given slugs, including their sub-categories. */
async function categoryIdsFor(slugs) {
  const all = await Category.find({ isDeleted: false }).lean();
  const picked = new Set(all.filter((c) => slugs.includes(c.slug)).map((c) => String(c._id)));
  for (const c of all) if (c.parentId && picked.has(String(c.parentId))) picked.add(String(c._id));
  return [...picked];
}

/**
 * Product ids that satisfy the collection / category / size / colour / stock
 * filters, or null when none of those filters is set.
 */
export async function resolveShopProductIds(shop) {
  let ids = null;
  const intersect = (set) => {
    ids = ids ? new Set([...ids].filter((id) => set.has(id))) : set;
  };

  if (shop.collections.length) intersect(await collectionProductIds(shop.collections));

  if (shop.categories.length) {
    const categoryIds = await categoryIdsFor(shop.categories);
    const rows = await Product.find({
      isDeleted: false,
      $or: [{ categoryId: { $in: categoryIds } }, { subcategoryId: { $in: categoryIds } }],
    }).lean();
    intersect(new Set(rows.map((p) => String(p._id))));
  }

  if (shop.sizes.length || shop.colors.length || shop.inStock) {
    const variantQuery = { isDeleted: false };
    if (ids) variantQuery.productId = { $in: [...ids] };
    const matched = new Set();
    // Size, colour and stock must all hold for the same variant.
    for (const v of await Variant.find(variantQuery).lean()) {
      if (shop.sizes.length && !shop.sizes.includes(String(v.size ?? "").toUpperCase())) continue;
      if (shop.colors.length && !shop.colors.includes(colorFamilyOf(v.color))) continue;
      if (shop.inStock && available(v) <= 0) continue;
      matched.add(String(v.productId));
    }
    intersect(matched);
  }

  return ids ? [...ids] : null;
}

/**
 * Options and counts for the filter panel. Counts are taken within the
 * current collection and search, so each option shows how many pieces it
 * would leave before the other filters are applied.
 */
export async function getShopFacets(query = {}) {
  const shop = parseShopQuery(query);
  const base = { status: "published", isDeleted: false };
  if (query.search) base.title = { $regex: escapeRegex(query.search), $options: "i" };

  const searched = await Product.find(base).lean();
  let products = searched;
  if (shop.collections.length) {
    const inCollection = await collectionProductIds(shop.collections);
    products = products.filter((p) => inCollection.has(String(p._id)));
  }
  const productIds = products.map((p) => String(p._id));

  const variants = productIds.length
    ? await Variant.find({ isDeleted: false, productId: { $in: productIds } }).lean()
    : [];

  const sizeMap = new Map();
  const colorMap = new Map();
  const inStockIds = new Set();
  for (const v of variants) {
    const pid = String(v.productId);
    const size = String(v.size ?? "").trim().toUpperCase();
    if (size) {
      if (!sizeMap.has(size)) sizeMap.set(size, { all: new Set(), inStock: new Set() });
      sizeMap.get(size).all.add(pid);
      if (available(v) > 0) sizeMap.get(size).inStock.add(pid);
    }
    const family = colorFamilyOf(v.color);
    if (family) {
      if (!colorMap.has(family)) colorMap.set(family, new Set());
      colorMap.get(family).add(pid);
    }
    if (available(v) > 0) inStockIds.add(pid);
  }

  const categoryRows = await Category.find({ isDeleted: false }).lean();
  const categories = categoryRows
    .filter((c) => (c.status ?? "active") === "active")
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      count: products.filter((p) => String(p.categoryId) === String(c._id) || String(p.subcategoryId) === String(c._id)).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Collection switcher counts ignore the current collection, so shoppers can see what's elsewhere.
  const searchedIds = new Set(searched.map((p) => String(p._id)));
  const collections = (await activeCollections())
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      count: (c.productIds || []).filter((id) => searchedIds.has(String(id))).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const prices = products.map((p) => Number(p.basePrice)).filter((n) => Number.isFinite(n));

  return {
    total: products.length,
    collections,
    categories,
    sizes: [...sizeMap.entries()]
      .map(([value, s]) => ({ value, count: s.all.size, inStockCount: s.inStock.size }))
      .sort((a, b) => compareSizes(a.value, b.value)),
    colors: [
      ...COLOR_FAMILIES.filter((f) => colorMap.has(f.value)).map((f) => ({
        value: f.value,
        label: f.label,
        swatch: f.swatch,
        count: colorMap.get(f.value).size,
      })),
      ...(colorMap.has(OTHER_COLOR_FAMILY)
        ? [{ value: OTHER_COLOR_FAMILY, label: "Other", swatch: "conic-gradient(#b3202a,#e9c434,#3f7d4e,#2e5aa8,#6b3a8f,#b3202a)", count: colorMap.get(OTHER_COLOR_FAMILY).size }]
        : []),
    ],
    price: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
    inStockCount: products.filter((p) => inStockIds.has(String(p._id))).length,
    onSaleCount: products.filter((p) => Number(p.mrp) > Number(p.basePrice)).length,
  };
}
