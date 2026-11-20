# SEO / GEO / AEO audit — 2026-11-20

The storefront at madalsa-web is a Next.js 16 app that renders the original React website **in the browser only**. Data comes from Turso.
Audited: source code, the live preview (madalsacouture.vercel.app) and a local production build on the local backup DB.
Re-run the automated check any time: `npm run build && npm start`, then `npm run seo:audit -- http://localhost:3000 madalsacouture.com`.

**Verdict: CONDITIONAL — explicit acceptance required.** Every code-level violation is fixed and verified. Still open:
- **V-09:** three policy pages need their text from the client.
- **Data:** some admin data needs correcting (V-10 to V-13).
- **Not yet checked:** live-domain checks wait for the cutover to madalsacouture.com (see Unverified).

## Route inventory

| Route | Index? | Status | Notes |
|---|---|---|---|
| `/` | yes | 200 | OnlineStore + WebSite JSON-LD |
| `/products` | yes | 200 | CollectionPage + ItemList; any `?params` are canonicalised to `/products` |
| `/product/:slug` (27) | yes when published | 200 / 404 | Product + Offer + AggregateRating (only real reviews) + BreadcrumbList |
| `/collections/:slug` (4) | yes when it has products | 200 / 404 | CollectionPage + ItemList + BreadcrumbList |
| `/about`, `/contact` | yes | 200 | AboutPage / ContactPage |
| `/terms` | yes | 200 | `/pages/terms-and-conditions` is canonicalised to it |
| `/privacy-policy`, `/refund-policy`, `/shipping-policy` | **no** until the text exists | 200 | Empty in the CMS (V-09) |
| `/pages/:slug` | yes if the page exists | 200 / 404 | |
| `/login` `/signup` `/forgot-password` `/reset-password` `/verify-email-change` `/unauthorized` `/cart` `/checkout` `/checkout-success` `/profile` `/my-orders` `/wishlist` `/addresses` `/order-success/*` `/user/*` `/admin/*` (40+) | no | 200 | noindex; cart/checkout/account/admin are also disallowed in robots.txt |
| anything else | no | **404** | Visitors are still sent home by the app, as before |
| `/api/*` | no | — | Disallowed in robots.txt |

Coverage: 49 URLs checked automatically. That covers every sitemap URL (36), 8 private routes and 5 not-found cases. 4 page types were also checked rendered in Chrome: home, product, collection and 404.

## Violation register

| ID | Sev | Finding | Status |
|---|---|---|---|
| V-01 | Critical | `robots.txt` and `sitemap.xml` returned the HTML app (200), so there was no robots file and no sitemap | Fixed: `src/app/robots.ts`, `src/app/sitemap.ts` |
| V-02 | Critical | Every URL had the same title and description, and no canonical tag | Fixed: per-page metadata in `src/app/[[...slug]]/page.tsx` + `src/seo/resolve.ts` |
| V-03 | Critical | Unknown URLs returned 200 with a copy of the home page (soft 404) | Fixed: real 404 + noindex (`src/app/not-found.tsx`) |
| V-04 | High | The server HTML had about 100 characters of text, so crawlers that don't run JavaScript (most AI crawlers) saw nothing | Fixed: hidden, server-rendered summary of the same content, removed once the app mounts (`src/seo/SeoSummary.tsx`). A product page's HTML now has about 2,150 characters of text |
| V-05 | High | The preview (`*.vercel.app`) and the API host (`onrender.com`) were indexable copies of the site | Fixed: noindex + `Disallow: /` on any host except `NEXT_PUBLIC_SITE_URL` |
| V-06 | High | No structured data | Fixed: Organization/OnlineStore, WebSite, Product/Offer, BreadcrumbList, CollectionPage/ItemList, AboutPage, ContactPage |
| V-07 | High | Admin SEO fields were misused: 441–480-character keyword-list titles (keyword stuffing), Pearl's title and description swapped, Serena's title describing "Rose Aura", "…Coutureg" typo | Guarded: `src/seo/fields.ts` rejects these and falls back to the product name/description. The data itself still needs fixing (V-10) |
| V-08 | Medium | Home page had no H1 | Fixed: screen-reader-only H1 (no visual change) |
| V-09 | High | Privacy, Refund and Shipping policy pages are empty (no CMS text), while the footer links to them | **Open (client).** Kept out of the index and sitemap until the text is added in Admin → CMS → Static pages |
| V-10 | Medium | Product data: SEO fields above; the same product description on 3 red dresses; "stone-muse-red-dress" titled like "Red Hot Short Dress"; serena/rose-aura-2 names swapped | **Open (client/admin)** |
| V-11 | Medium | Collection and category descriptions are placeholders ("This is the Best Seller") | **Open (client).** Meta descriptions are built from facts instead |
| V-12 | Low | All 27 products have gender "Unisex" although the copy says women's wear | **Open (admin)** |
| V-13 | Low | The image uploader saved camera file names ("IMG_5347") as alt text | Fixed for new uploads (`MultiImageUploader.tsx`). The storefront already uses product names as alt text |
| V-14 | Low | The browser-tab title never changed during in-app navigation (a 404 sent visitors home with "Page not found" still in the tab) | Fixed: `DocumentTitle` in `src/legacy-ui/routes/index.tsx` |
| V-15 | Low | Layout had a meaningless `keywords` meta and a duplicate `title` meta; `lang="en"` | Fixed: cleaned up, `lang="en-IN"`, `metadataBase` |
| V-16 | Info | Contact page shows a "Flagship Address" of only "Bhopal, Madhya Pradesh". LocalBusiness markup and a Google Business Profile need a full street address, if there is a walk-in store | Open question for the client |

Checked and fine:
- Image alt text on cards and product images (product name); empty alt only on decorative or labelled-button images.
- One H1 on the product, collection, about and contact pages.
- No hreflang needed (a single language).
- No fake reviews: ratings come only from the reviews shown on the page.
- No doorway or location pages.

## Rounds
1. **Investigation:**
   - Ran Chrome and HTTP checks against the live preview.
   - Read the router, metadata and data models.
   - Found V-01…V-16.
2. **Remediation:**
   - Built the SEO module (`src/seo/`), robots, sitemap, 404, metadata and JSON-LD.
   - Added unit tests (`src/seo/seo.test.ts`) and the crawl script (`scripts/seo-audit.ts`).
   - The first runs exposed the admin-data problems (V-07).
3. **Adversarial re-check:**
   - Tested edge cases: trailing slashes (308 to the clean URL), tracking parameters (canonical strips them), upper-case slugs (canonical to the real URL), the `/pages/` alias of `/terms`, and preview hosts.
   - Found and fixed:
     - a duplicate robots tag on 404s;
     - a keyword-list check that rejected normal sentences;
     - a breadcrumb label that didn't match the visible page;
     - stale tab titles.
   - Final run: 49/49 pass, site-wide checks pass.

Build, typecheck, lint (0 errors) and 21 unit tests pass. See `automated-test-results.txt`.

## Unverified (needs the live domain after cutover)
- Google Search Console and Bing Webmaster Tools: add the property, submit `https://madalsacouture.com/sitemap.xml`, inspect a product URL.
- Google Rich Results Test and the Schema Markup Validator on one product, one collection and the home page.
- Core Web Vitals / PageSpeed Insights (no field data yet; not measured).
- The real CDN/WAF does not block crawlers on the production domain.
- Rankings and AI-answer visibility are outcomes to monitor, not release criteria.
