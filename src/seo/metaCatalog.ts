import "server-only";
import { SITE_NAME, absoluteUrl } from "@/seo/config";
import { type Doc, getProduct, listProducts } from "@/seo/data";
import { toText } from "@/seo/text";

/**
 * Product feed for Meta Commerce Manager (catalog ads / Advantage+ catalog ads), as RSS 2.0
 * with Google Merchant `g:` fields, which Meta reads. Served at /feeds/meta-catalog.xml.
 *
 * One item per product. Its id is the product's database id: the same id the pixel and the
 * Conversions API send as content_ids (ViewContent, AddToCart, InitiateCheckout, Purchase), so
 * Meta can tie each visitor's activity to the product in the catalog. Changing the id breaks that.
 */

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  availability: "in stock" | "out of stock";
  price: number;
  salePrice: number | null;
  brand: string;
  productType: string | null;
  gender: "female" | "male" | null;
}

const money = (n: number) => `${n.toFixed(2)} INR`;

/** Text safe inside XML: control characters removed, markup characters escaped. */
export function xml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Feed entry for one product (as returned by productService.getProductBySlug), or null if it can't be sold. */
export function toCatalogItem(p: Doc): CatalogItem | null {
  const title = toText(p.title);
  const imageLink = p.primaryImage || p.images?.[0]?.url;
  const prices = (p.variants || [])
    .map((v: Doc) => Number(v.price ?? p.basePrice))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  const low = prices.length ? Math.min(...prices) : Number(p.basePrice);
  if (!title || !imageLink || !p.slug || !Number.isFinite(low) || low <= 0) return null;

  const mrp = Number(p.mrp);
  const onSale = Number.isFinite(mrp) && mrp > low;
  const images = [...new Set([p.primaryImage, ...(p.images || []).map((i: Doc) => i?.url)].filter(Boolean))] as string[];
  // Gender only when the admin set a real one: "Unisex" is currently on every product by default.
  const g = String(p.gender || "").toLowerCase();
  const gender = /^(women|woman|female|ladies)$/.test(g) ? "female" : /^(men|man|male)$/.test(g) ? "male" : null;

  return {
    id: String(p._id),
    title: title.slice(0, 200),
    description: (toText(p.description || p.shortDescription) || title).slice(0, 9999),
    link: absoluteUrl(`/product/${encodeURIComponent(p.slug)}`),
    imageLink,
    additionalImageLinks: images.filter((u) => u !== imageLink).slice(0, 10),
    availability: p.inStock ? "in stock" : "out of stock",
    price: onSale ? mrp : low,
    salePrice: onSale ? low : null,
    brand: toText(p.brand) || SITE_NAME,
    productType: p.category?.name ? toText(p.category.name) : null,
    gender,
  };
}

export function catalogXml(items: CatalogItem[]): string {
  const tag = (name: string, value: string | null | undefined) => (value ? `<g:${name}>${xml(value)}</g:${name}>` : "");
  const entries = items.map((i) =>
    [
      "<item>",
      tag("id", i.id),
      tag("title", i.title),
      tag("description", i.description),
      tag("link", i.link),
      tag("image_link", i.imageLink),
      ...i.additionalImageLinks.map((u) => tag("additional_image_link", u)),
      tag("availability", i.availability),
      tag("condition", "new"),
      tag("price", money(i.price)),
      tag("sale_price", i.salePrice ? money(i.salePrice) : null),
      tag("brand", i.brand),
      tag("google_product_category", "Apparel & Accessories > Clothing"),
      tag("product_type", i.productType),
      tag("gender", i.gender),
      "</item>",
    ].join(""),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    `<title>${xml(SITE_NAME)}</title>`,
    `<link>${xml(absoluteUrl("/"))}</link>`,
    `<description>${xml(`${SITE_NAME} product catalog`)}</description>`,
    ...entries,
    "</channel>",
    "</rss>",
  ].join("\n");
}

/** Every published product that can be sold, with stock and prices from the live data. */
export async function buildMetaCatalog(): Promise<CatalogItem[]> {
  const products = await listProducts();
  const full = await Promise.all(products.map((p: Doc) => getProduct(p.slug)));
  return full.filter((p: Doc) => p && p.status === "published").map(toCatalogItem).filter(Boolean) as CatalogItem[];
}
