import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { absoluteUrl, isProductionHost } from "@/seo/config";

// robots.txt. On the real domain: everything public may be crawled (including AI search crawlers),
// account/checkout/admin screens and the API may not. On any other host (vercel.app previews,
// the Render API host, localhost) crawling is refused so those copies don't compete with the site.
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!isProductionHost((await headers()).get("host"))) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/user/", "/checkout", "/cart", "/profile", "/my-orders", "/wishlist", "/addresses", "/order-success/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
