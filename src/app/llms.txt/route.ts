import { POLICY_ROUTES, SITE_NAME, absoluteUrl, isProductionHost } from "@/seo/config";
import { type Doc, getCollection, getStaticPage, listCollections } from "@/seo/data";
import { buildMetaCatalog } from "@/seo/metaCatalog";
import { HOME_DESCRIPTION } from "@/seo/resolve";
import { formatInr, summarize, toText } from "@/seo/text";
import { headers } from "next/headers";

// /llms.txt (llmstxt.org): a plain Markdown map of the shop for AI assistants and agents.
// Built from the same live data and rules as the sitemap: only public pages that exist.
export const dynamic = "force-dynamic";

export async function GET() {
  const host = (await headers()).get("host");
  // Preview and API hosts must not look like the shop (same rule as robots.txt).
  if (!isProductionHost(host)) return new Response("Not found", { status: 404 });

  try {
    const [products, collections] = await Promise.all([buildMetaCatalog(), listCollections()]);
    const liveCollections = (
      await Promise.all(collections.map(async (c: Doc) => ((await getCollection(c.slug))?.products?.length ? c : null)))
    ).filter(Boolean);
    const policies = (
      await Promise.all(
        Object.entries(POLICY_ROUTES).map(async ([route, { slug }]) => {
          const page = await getStaticPage(slug);
          return page && toText(page.body) ? { route, title: toText(page.title) || route } : null;
        }),
      )
    ).filter(Boolean) as { route: string; title: string }[];

    const line = (label: string, url: string, note?: string) => `- [${label}](${url})${note ? `: ${note}` : ""}`;
    const text = [
      `# ${SITE_NAME}`,
      "",
      `> ${HOME_DESCRIPTION}`,
      "",
      "Prices are in Indian rupees (INR). Orders are placed on the website.",
      "",
      "## Shop",
      line("All products", absoluteUrl("/products")),
      ...liveCollections.map((c: Doc) => line(toText(c.name), absoluteUrl(`/collections/${encodeURIComponent(c.slug)}`))),
      "",
      "## Products",
      ...products.map((p) =>
        line(
          p.title,
          p.link,
          [formatInr(p.salePrice ?? p.price), p.availability === "in stock" ? "in stock" : "out of stock", summarize(p.description, 140)]
            .filter(Boolean)
            .join(" · "),
        ),
      ),
      "",
      "## About",
      line("Our story", absoluteUrl("/about")),
      line("Contact", absoluteUrl("/contact")),
      "",
      "## Policies",
      ...policies.map((p) => line(p.title, absoluteUrl(`/${p.route}`))),
      "",
    ].join("\n");

    return new Response(text, {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return new Response("Temporarily unavailable", { status: 503, headers: { "Retry-After": "300" } });
  }
}
