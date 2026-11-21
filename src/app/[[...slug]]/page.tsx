import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl, isProductionHost } from "@/seo/config";
import { getHeroFirstImage } from "@/seo/data";
import { resolvePage } from "@/seo/resolve";
import { JsonLd, SeoSummary } from "@/seo/SeoSummary";
import { optimizeImage } from "@/legacy-ui/utils/imageUtils";
import { LegacyApp } from "./legacy-app";

// Every non-API URL renders the original React website, which handles its own routing in the browser.
// The server adds what search engines need: a per-page title, description, canonical address,
// robots rule, structured data, a plain summary of the content, and a real 404 for unknown URLs.

type Props = { params: Promise<{ slug?: string[] }> };

const keyOf = async (params: Props["params"]) => ((await params).slug || []).join("/");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seo = await resolvePage(await keyOf(params));
  // Preview copies (*.vercel.app, the API host, localhost) must never compete with the real site.
  const indexableHost = isProductionHost((await headers()).get("host"));

  if (!seo) return indexableHost ? {} : { robots: { index: false, follow: false } };
  if (seo.notFound) return { title: seo.title }; // Next.js adds "noindex" to 404 responses itself

  const url = absoluteUrl(seo.path);
  const image = seo.image || DEFAULT_OG_IMAGE;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: url },
    robots:
      seo.index && indexableHost
        ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
        : { index: false, follow: indexableHost },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", url, title: seo.title, description: seo.description, images: [image] },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, images: [image] },
  };
}

// Same widths and sizes as the home banner (Hero.tsx), so the preloaded file is the one it uses.
const srcSet = (url: string, widths: number[]) => widths.map((w) => `${optimizeImage(url, w)} ${w}w`).join(", ");

async function HeroPreload() {
  const hero = await getHeroFirstImage().catch(() => null);
  if (!hero) return null;
  const desktop = srcSet(hero.mediaUrl, [640, 960, 1280, 1920]);
  if (!hero.mobileMediaUrl) return <link rel="preload" as="image" imageSrcSet={desktop} imageSizes="100vw" fetchPriority="high" />;
  return (
    <>
      <link rel="preload" as="image" media="(max-width: 639px)" imageSrcSet={srcSet(hero.mobileMediaUrl, [640, 1080])} imageSizes="100vw" fetchPriority="high" />
      <link rel="preload" as="image" media="(min-width: 640px)" imageSrcSet={desktop} imageSizes="100vw" fetchPriority="high" />
    </>
  );
}

export default async function Page({ params }: Props) {
  const key = await keyOf(params);
  const seo = await resolvePage(key);
  if (seo?.notFound) notFound();
  return (
    <>
      {/* Home: start the banner photo now. Without this it was found ~5 s in (app, then API, then image). */}
      {key === "" ? <HeroPreload /> : null}
      {/* Start the main photo downloading now instead of after the app loads and fetches the
          product. The URL must match ProductDetails exactly (optimizeImage at 1000px) or it is
          downloaded twice. React moves this tag into <head>. */}
      {seo?.heroImage ? (
        <link rel="preload" as="image" href={optimizeImage(seo.heroImage, 1000)} fetchPriority="high" />
      ) : null}
      {seo?.jsonLd.length ? <JsonLd items={seo.jsonLd} /> : null}
      <LegacyApp>{seo ? <SeoSummary seo={seo} /> : null}</LegacyApp>
    </>
  );
}
