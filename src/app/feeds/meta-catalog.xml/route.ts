import { buildMetaCatalog, catalogXml } from "@/seo/metaCatalog";

// Meta Commerce Manager → Catalog → Data sources → Data feed → scheduled feed:
// https://madalsacouture.com/feeds/meta-catalog.xml (set it to refresh hourly or daily).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const xml = catalogXml(await buildMetaCatalog());
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // Prices and stock may be up to 15 minutes old at the CDN.
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    // A database outage must not hand Meta an empty feed (it would remove every product).
    return new Response("Catalog temporarily unavailable", { status: 503, headers: { "Retry-After": "300" } });
  }
}
