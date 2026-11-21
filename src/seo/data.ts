import "server-only";
import { ensureSchema } from "@/db/migrate";
import { AboutUs, Category, Collection, Comment, Contact, Product } from "@/server/models/registry";
import productService from "@/server/services/productService";
import collectionService from "@/server/services/collectionService";
import staticPageService from "@/server/modules/cms/staticPages/staticPageService";
import heroService from "@/server/modules/cms/hero/heroService";

// Server-side reads for page titles, descriptions, structured data and the sitemap.
// Every function returns null for "doesn't exist" and THROWS on a database problem, so callers
// can tell a real 404 from an outage (an outage must never turn pages into 404s).

// Documents are schemaless (Mongo-compatible layer), so they are typed loosely here.
export type Doc = any;

const isNotFound = (err: Doc) => err?.statusCode === 404 || err?.name === "CastError";

export async function getProduct(slug: string): Promise<Doc> {
  await ensureSchema();
  try {
    return await productService.getProductBySlug(slug);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Average rating and count of the customer reviews shown on the product page. */
export async function getProductRating(productId: string): Promise<Doc> {
  await ensureSchema();
  const rated = await Comment.find({ productId, isDeleted: false, rating: { $ne: null } }).select("rating").lean();
  const ratings = rated.map((c: Doc) => Number(c.rating)).filter((r: number) => r >= 1 && r <= 5);
  if (ratings.length === 0) return null;
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { ratingValue: Math.round(avg * 10) / 10, ratingCount: ratings.length };
}

export async function getCollection(slug: string): Promise<Doc> {
  await ensureSchema();
  let collection: Doc;
  try {
    collection = await collectionService.getCollectionBySlug(slug);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
  if (!collection || collection.status !== "active") return null;
  const products = (await collectionService.resolveProducts(collection)).filter((p: Doc) => p.status === "published");
  return { ...collection, products };
}

export async function getStaticPage(slug: string): Promise<Doc> {
  await ensureSchema();
  return (await staticPageService.getPageBySlugPublic(slug)) || null;
}

export async function getContact(): Promise<Doc> {
  await ensureSchema();
  return (await Contact.findOne({ isDeleted: false, status: "active" }).lean()) || null;
}

export async function getAboutUs(): Promise<Doc> {
  await ensureSchema();
  return (await AboutUs.findOne({ isDeleted: false }).lean()) || null;
}

export async function listProducts(): Promise<Doc> {
  await ensureSchema();
  return Product.find({ status: "published", isDeleted: false })
    .select("title slug basePrice mrp primaryImage images updatedAt")
    .sort({ createdAt: -1 })
    .lean();
}

export async function listCollections(): Promise<Doc> {
  await ensureSchema();
  return Collection.find({ status: "active", isDeleted: false }).select("name slug updatedAt").sort({ name: 1 }).lean();
}

export async function listCategories(): Promise<Doc> {
  await ensureSchema();
  return Category.find({ status: "active", isDeleted: false }).select("name slug").sort({ displayOrder: 1 }).lean();
}

/**
 * The home banner's first slide when it is a photo (the page's largest image), so the server can
 * start downloading it before the app asks the API. Same lookup and order as the public hero API.
 */
export async function getHeroFirstImage(): Promise<{ mediaUrl: string; mobileMediaUrl: string | null } | null> {
  await ensureSchema();
  const hero: Doc = await heroService.getHeroPublic();
  if (!hero) return null;
  const first: Doc = hero.media?.length ? hero.media[0] : hero.mediaUrl ? { mediaType: hero.mediaType || "image", mediaUrl: hero.mediaUrl } : null;
  if (!first || first.mediaType === "video" || !first.mediaUrl) return null;
  return { mediaUrl: String(first.mediaUrl), mobileMediaUrl: first.mobileMediaUrl ? String(first.mobileMediaUrl) : null };
}
