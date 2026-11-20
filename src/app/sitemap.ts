import type { MetadataRoute } from "next";
import { POLICY_ROUTES, absoluteUrl } from "@/seo/config";
import { type Doc, getCollection, getStaticPage, listCollections, listProducts } from "@/seo/data";
import { toText } from "@/seo/text";

// sitemap.xml: only pages that are public, indexable and canonical — the same rules the pages
// themselves use (empty collections and policy pages without text are left out).
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const lastMod = (d: Doc): Date | undefined => (d ? new Date(d) : undefined);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections] = await Promise.all([listProducts(), listCollections()]);
  const collectionPages = (
    await Promise.all(collections.map(async (c: Doc) => ((await getCollection(c.slug))?.products?.length ? c : null)))
  ).filter(Boolean);
  const policyPages = (
    await Promise.all(
      Object.entries(POLICY_ROUTES).map(async ([route, { slug }]) => {
        const page = await getStaticPage(slug);
        return page && toText(page.body) ? { route, updatedAt: page.updatedAt } : null;
      }),
    )
  ).filter(Boolean);
  const newest = products.reduce((max: Date | undefined, p: Doc) => (p.updatedAt && (!max || new Date(p.updatedAt) > max) ? new Date(p.updatedAt) : max), undefined);

  return [
    { url: absoluteUrl("/"), lastModified: newest, changeFrequency: "weekly" as const, priority: 1 },
    { url: absoluteUrl("/products"), lastModified: newest, changeFrequency: "weekly" as const, priority: 0.9 },
    ...collectionPages.map((c: Doc) => ({ url: absoluteUrl(`/collections/${encodeURIComponent(c.slug)}`), lastModified: lastMod(c.updatedAt), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p: Doc) => ({
      url: absoluteUrl(`/product/${encodeURIComponent(p.slug)}`),
      lastModified: lastMod(p.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: [p.primaryImage].filter(Boolean),
    })),
    { url: absoluteUrl("/about"), changeFrequency: "monthly" as const, priority: 0.5 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly" as const, priority: 0.5 },
    ...policyPages.map((p: Doc) => ({ url: absoluteUrl(`/${p.route}`), lastModified: lastMod(p.updatedAt), changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
