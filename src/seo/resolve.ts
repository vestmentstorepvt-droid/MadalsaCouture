import "server-only";
import { cache } from "react";
import { DEFAULT_OG_IMAGE, POLICY_ROUTES, PRIVATE_PREFIXES, PRIVATE_ROUTES, SITE_NAME, absoluteUrl } from "./config";
import * as data from "./data";
import type { Doc } from "./data";
import { usableSeoDescription, usableSeoTitle } from "./fields";
import { formatInr, joinNames, summarize, toParagraphs, toText } from "./text";

// Works out, on the server, what every storefront URL is: its title, description, canonical
// address, whether it may be indexed, its structured data (JSON-LD) and a plain summary of the
// page content for crawlers that don't run JavaScript. The website itself still renders in the
// browser exactly as before; this only adds what search engines and AI crawlers need.

export type Link = { href: string; label: string };
export type PageSeo = {
  notFound?: boolean;
  title: string;
  description: string;
  path: string;
  index: boolean;
  image?: string;
  /** Raw URL of the photo the page shows largest first (preloaded before the app's JavaScript runs). */
  heroImage?: string;
  jsonLd: object[];
  summary: {
    h1: string;
    paragraphs: string[];
    facts?: [string, string][];
    sections?: { heading: string; items: string[] }[];
    links?: { heading: string; items: Link[] };
    breadcrumbs?: Link[];
  } | null;
};

const ORG_ID = absoluteUrl("/#organization");
const SITE_ID = absoluteUrl("/#website");
const SOCIAL_PROFILES = ["https://www.instagram.com/madalsacouture"];
const HOME_TITLE = `${SITE_NAME} | Designer Anarkali, Kurta & Sharara Sets`;
export const HOME_DESCRIPTION =
  "Discover the artistry, heritage, and vision behind Madalsa Couture. Premium bespoke tailoring, hand-embroidered detailing, and ethnic luxury wear.";

const withBrand = (t: string) => (t.toLowerCase().includes(SITE_NAME.toLowerCase()) ? t : `${t} | ${SITE_NAME}`);

const breadcrumbLd = (items: Link[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.label, item: absoluteUrl(item.href) })),
});

const productLinks = (products: Doc[]): Link[] =>
  products.filter((p: Doc) => p?.slug).map((p: Doc) => ({ href: `/product/${encodeURIComponent(p.slug)}`, label: toText(p.title) }));

const notFound = (): PageSeo => ({ notFound: true, title: `Page not found | ${SITE_NAME}`, description: "", path: "/", index: false, jsonLd: [], summary: null });

const privatePage = (label: string, path: string): PageSeo => ({
  title: `${label} | ${SITE_NAME}`,
  description: `${label} — ${SITE_NAME}.`,
  path,
  index: false,
  jsonLd: [],
  summary: null,
});

async function organizationLd() {
  const contact = await data.getContact().catch(() => null);
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/assets/madalsa-logo.webp"),
    image: DEFAULT_OG_IMAGE,
    description: HOME_DESCRIPTION,
    sameAs: SOCIAL_PROFILES,
    ...(contact?.email ? { email: contact.email } : {}),
    ...(contact?.phone ? { telephone: contact.phone } : {}),
    ...(contact?.address ? { address: toText(contact.address) } : {}),
    ...(contact?.phone || contact?.email
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            ...(contact.phone ? { telephone: contact.phone } : {}),
            ...(contact.email ? { email: contact.email } : {}),
          },
        }
      : {}),
  };
}

async function home(): Promise<PageSeo> {
  const [products, collections] = await Promise.all([data.listProducts(), data.listCollections()]);
  return {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
    index: true,
    jsonLd: [
      await organizationLd(),
      { "@context": "https://schema.org", "@type": "WebSite", "@id": SITE_ID, name: SITE_NAME, url: absoluteUrl("/"), publisher: { "@id": ORG_ID }, inLanguage: "en-IN" },
    ],
    summary: {
      h1: SITE_NAME,
      paragraphs: [HOME_DESCRIPTION],
      sections: collections.length ? [{ heading: "Collections", items: collections.map((c: Doc) => toText(c.name)) }] : [],
      links: { heading: "Shop", items: [...collections.map((c: Doc) => ({ href: `/collections/${c.slug}`, label: toText(c.name) })), ...productLinks(products)] },
    },
  };
}

async function allProducts(): Promise<PageSeo> {
  const [products, categories] = await Promise.all([data.listProducts(), data.listCategories()]);
  const kinds = joinNames(categories.map((c: Doc) => toText(c.name)), 4);
  const description = summarize(
    `Shop all ${products.length} designs from ${SITE_NAME}${kinds ? `: ${kinds}` : ""}. Browse ${joinNames(products.map((p: Doc) => toText(p.title)), 3)} and more.`,
  );
  const crumbs = [{ href: "/", label: "Home" }, { href: "/products", label: "All products" }];
  return {
    title: `Shop All Designs | ${SITE_NAME}`,
    description,
    path: "/products",
    index: true,
    jsonLd: [
      breadcrumbLd(crumbs),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "All products",
        url: absoluteUrl("/products"),
        isPartOf: { "@id": SITE_ID },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: products.length,
          itemListElement: products.map((p: Doc, i: number) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/product/${p.slug}`), name: toText(p.title) })),
        },
      },
    ],
    summary: { h1: "All products", paragraphs: [description], breadcrumbs: crumbs, links: { heading: "Products", items: productLinks(products) } },
  };
}

async function product(slug: string): Promise<PageSeo> {
  const p = await data.getProduct(slug);
  if (!p) return notFound();
  const name = toText(p.title);
  const path = `/product/${encodeURIComponent(p.slug)}`;
  const url = absoluteUrl(path);
  const seoTitle = usableSeoTitle(p.seo?.metaTitle, name);
  const seoDescription = usableSeoDescription(p.seo?.metaDescription, name);
  const description = seoDescription || summarize(p.description || p.shortDescription || name);
  const images = [p.primaryImage, ...(p.images || []).map((i: Doc) => i?.url)].filter(Boolean).filter((u: string, i: number, a: string[]) => a.indexOf(u) === i).slice(0, 8);
  const prices = (p.variants || []).map((v: Doc) => Number(v.price ?? p.basePrice)).filter((n: number) => Number.isFinite(n) && n > 0);
  const low = prices.length ? Math.min(...prices) : Number(p.basePrice);
  const high = prices.length ? Math.max(...prices) : Number(p.basePrice);
  const availability = p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const rating = await data.getProductRating(String(p._id)).catch(() => null);
  const crumbs = [{ href: "/", label: "Home" }, { href: "/products", label: "Shop" }, { href: path, label: name }];
  const pairs = (list: Doc) => (Array.isArray(list) ? list.filter((x: Doc) => x?.label && x?.value).map((x: Doc) => [toText(x.label), toText(x.value)] as [string, string]) : []);
  const lines = (list: Doc): string[] => (Array.isArray(list) ? list.map(toText).filter(Boolean) : typeof list === "string" && list.trim() ? [toText(list)] : []);
  const sizes = (p.variants || []).map((v: Doc) => v.size).filter(Boolean);

  const offer =
    Number.isFinite(low) && low > 0
      ? low === high
        ? { "@type": "Offer", url, priceCurrency: "INR", price: low, availability, itemCondition: "https://schema.org/NewCondition", seller: { "@id": ORG_ID } }
        : { "@type": "AggregateOffer", url, priceCurrency: "INR", lowPrice: low, highPrice: high, offerCount: prices.length, availability, seller: { "@id": ORG_ID } }
      : null;

  return {
    title: withBrand(seoTitle || name),
    description,
    path,
    index: p.status === "published",
    image: p.primaryImage || images[0],
    // ProductDetails shows primaryImage first when it is set; otherwise its order can differ.
    ...(p.primaryImage ? { heroImage: p.primaryImage } : {}),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": `${url}#product`,
        name,
        description: toText(p.description || p.shortDescription || name).slice(0, 5000),
        url,
        image: images,
        ...(p.sku ? { sku: p.sku } : {}),
        brand: { "@type": "Brand", name: SITE_NAME },
        ...(p.category?.name ? { category: toText(p.category.name) } : {}),
        ...(p.specifications?.countryOfOrigin ? { countryOfOrigin: { "@type": "Country", name: toText(p.specifications.countryOfOrigin) } } : {}),
        ...(p.specifications?.fabric ? { material: toText(p.specifications.fabric) } : {}),
        ...(sizes.length ? { size: sizes } : {}),
        ...(offer ? { offers: offer } : {}),
        ...(rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.ratingValue, ratingCount: rating.ratingCount, bestRating: 5, worstRating: 1 } } : {}),
      },
      breadcrumbLd(crumbs),
    ],
    summary: {
      h1: name,
      breadcrumbs: crumbs,
      facts: [
        ...(Number.isFinite(low) && low > 0 ? [["Price", low === high ? formatInr(low) : `${formatInr(low)} – ${formatInr(high)}`] as [string, string]] : []),
        ...(p.mrp && Number(p.mrp) > low ? [["MRP", formatInr(p.mrp)] as [string, string]] : []),
        ["Availability", p.inStock ? "In stock" : "Out of stock"],
        ...(sizes.length ? [["Sizes", sizes.join(", ")] as [string, string]] : []),
        ...(p.category?.name ? [["Category", toText(p.category.name)] as [string, string]] : []),
      ],
      paragraphs: toParagraphs(p.description),
      sections: [
        { heading: "Product details", items: pairs(p.productDetails).map(([k, v]) => `${k}: ${v}`) },
        { heading: "Size & fit", items: pairs(p.sizeFit).map(([k, v]) => `${k}: ${v}`) },
        { heading: "Styling tips", items: lines(p.stylingTips) },
        { heading: "Care instructions", items: lines(p.careInstructions) },
        { heading: "Delivery & returns", items: lines(p.deliveryReturns) },
        { heading: "Disclaimer", items: lines(p.disclaimer) },
      ].filter((s) => s.items.length),
      links: { heading: "More to explore", items: productLinks([...(p.relatedProducts || []), ...(p.crossSellProducts || []), ...(p.upSellProducts || [])]) },
    },
  };
}

async function collection(slug: string): Promise<PageSeo> {
  const c = await data.getCollection(slug);
  if (!c) return notFound();
  const name = toText(c.name);
  const path = `/collections/${encodeURIComponent(c.slug)}`;
  const products = c.products || [];
  // Collection descriptions in the CMS are placeholders ("This is the Best Seller"), so the
  // description is built from facts: the collection name and the designs it contains.
  const description = summarize(
    products.length
      ? `Shop the ${name} collection at ${SITE_NAME}: ${products.length} design${products.length === 1 ? "" : "s"} including ${joinNames(products.map((p: Doc) => toText(p.title)), 3)}.`
      : `The ${name} collection at ${SITE_NAME}.`,
  );
  const crumbs = [{ href: "/", label: "Home" }, { href: path, label: name }];
  return {
    title: `${name} Collection | ${SITE_NAME}`,
    description,
    path,
    index: products.length > 0, // an empty collection is a thin page
    image: c.imageUrl || products[0]?.primaryImage || undefined,
    jsonLd: [
      breadcrumbLd(crumbs),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name,
        url: absoluteUrl(path),
        isPartOf: { "@id": SITE_ID },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: products.length,
          itemListElement: products.map((p: Doc, i: number) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/product/${p.slug}`), name: toText(p.title) })),
        },
      },
    ],
    summary: { h1: name, paragraphs: [description], breadcrumbs: crumbs, links: { heading: "Designs in this collection", items: productLinks(products) } },
  };
}

async function about(): Promise<PageSeo> {
  const a = await data.getAboutUs();
  const description = "The story behind Madalsa Couture: heirloom fabrics, hand-embroidered zari and beadwork by master artisans, and personalised sizing and styling.";
  const crumbs = [{ href: "/", label: "Home" }, { href: "/about", label: "About" }];
  const badges = (a?.craftBadges || []).filter((b: Doc) => b?.title).map((b: Doc) => `${toText(b.title)}${b.description ? ` — ${toText(b.description)}` : ""}`);
  const virtues = (a?.virtues || []).filter((v: Doc) => v?.label).map((v: Doc) => `${toText(v.label)}${v.desc ? ` — ${toText(v.desc)}` : ""}`);
  return {
    title: `About Us | ${SITE_NAME}`,
    description: badges.length ? description : summarize(HOME_DESCRIPTION),
    path: "/about",
    index: true,
    jsonLd: [breadcrumbLd(crumbs), { "@context": "https://schema.org", "@type": "AboutPage", name: `About ${SITE_NAME}`, url: absoluteUrl("/about"), about: { "@id": ORG_ID } }],
    summary: {
      h1: "Timeless Elegance & Contemporary Grace",
      breadcrumbs: crumbs,
      paragraphs: toParagraphs(a?.body).length ? toParagraphs(a?.body) : [HOME_DESCRIPTION],
      sections: [
        { heading: "Our craft", items: badges },
        { heading: "What we value", items: virtues },
      ].filter((s) => s.items.length),
    },
  };
}

async function contact(): Promise<PageSeo> {
  const c = await data.getContact();
  const crumbs = [{ href: "/", label: "Home" }, { href: "/contact", label: "Contact" }];
  const facts: [string, string][] = [
    ...(c?.address ? [["Address", toText(c.address)] as [string, string]] : []),
    ...(c?.phone ? [["Phone / WhatsApp", toText(c.phone)] as [string, string]] : []),
    ...(c?.email ? [["Email", toText(c.email)] as [string, string]] : []),
    ...(c?.businessHours ? [["Hours", toText(c.businessHours)] as [string, string]] : []),
  ];
  const description = summarize(
    `Contact ${SITE_NAME} for custom sizing, styling help or order support${c?.phone ? ` — call or WhatsApp ${toText(c.phone)}` : ""}${c?.email ? `, email ${toText(c.email)}` : ""}${c?.businessHours ? ` (${toText(c.businessHours)})` : ""}.`,
  );
  return {
    title: `Contact Us | ${SITE_NAME}`,
    description,
    path: "/contact",
    index: true,
    jsonLd: [breadcrumbLd(crumbs), { "@context": "https://schema.org", "@type": "ContactPage", name: `Contact ${SITE_NAME}`, url: absoluteUrl("/contact"), about: { "@id": ORG_ID } }],
    summary: {
      h1: "Connect With Our Atelier",
      breadcrumbs: crumbs,
      paragraphs: ["Whether you need custom sizing, virtual styling consultations, or order assistance, our couture specialists are at your service."],
      facts,
    },
  };
}

async function staticPage(route: string, slug: string, fallbackTitle: string): Promise<PageSeo> {
  const page = await data.getStaticPage(slug);
  const path = `/${route}`;
  const title = toText(page?.title) || fallbackTitle;
  const crumbs = [{ href: "/", label: "Home" }, { href: path, label: title }];
  if (!page || !toText(page.body)) {
    // The page exists in the website but its text hasn't been added in the admin yet: keep it out of search.
    return { title: `${fallbackTitle} | ${SITE_NAME}`, description: `${fallbackTitle} — ${SITE_NAME}.`, path, index: false, jsonLd: [], summary: null };
  }
  return {
    title: withBrand(usableSeoTitle(page.seo?.metaTitle, title) || title),
    description: usableSeoDescription(page.seo?.metaDescription, title) || summarize(page.body),
    path,
    index: true,
    jsonLd: [breadcrumbLd(crumbs), { "@context": "https://schema.org", "@type": "WebPage", name: title, url: absoluteUrl(path), dateModified: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined, isPartOf: { "@id": SITE_ID } }],
    summary: { h1: title, breadcrumbs: crumbs, paragraphs: toParagraphs(page.body, 200) },
  };
}

async function cmsPage(slug: string): Promise<PageSeo> {
  // A policy page is also reachable at /pages/<slug>; the canonical address is its own route.
  const policy = Object.entries(POLICY_ROUTES).find(([, v]) => v.slug === slug);
  if (policy) {
    const seo = await staticPage(policy[0], slug, policy[1].title);
    return { ...seo, path: `/${policy[0]}` };
  }
  const page = await data.getStaticPage(slug);
  if (!page) return notFound();
  const seo = await staticPage(`pages/${slug}`, slug, toText(page.title));
  return seo;
}

/** Resolve a storefront path (segments after the domain) to its SEO description. */
async function resolve(segments: string[]): Promise<PageSeo> {
  const [first = "", second, ...rest] = segments.map((s) => decodeURIComponent(s));
  const path = `/${segments.join("/")}`;

  if (!first) return home();
  if (PRIVATE_ROUTES[first] && !second) return privatePage(PRIVATE_ROUTES[first], path);
  if (PRIVATE_PREFIXES[first]) return privatePage(PRIVATE_PREFIXES[first], path);
  if (rest.length) return notFound();

  if (first === "products" && !second) return allProducts();
  if (first === "product" && second) return product(second);
  if (first === "collections" && second) return collection(second);
  if (first === "pages" && second) return cmsPage(second);
  if (second) return notFound();
  if (first === "about") return about();
  if (first === "contact") return contact();
  if (POLICY_ROUTES[first]) return staticPage(first, POLICY_ROUTES[first].slug, POLICY_ROUTES[first].title);
  return notFound();
}

/** Per-request memo: generateMetadata and the page both ask for the same URL. */
export const resolvePage = cache(async (key: string): Promise<PageSeo | null> => {
  try {
    return await resolve(key ? key.split("/") : []);
  } catch (err) {
    // Database trouble: serve the page normally with the site defaults rather than a false 404.
    console.error("[seo] could not resolve", key, (err as Error)?.message);
    return null;
  }
});

export const FALLBACK_SEO: PageSeo = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
  index: false,
  jsonLd: [],
  summary: null,
};
