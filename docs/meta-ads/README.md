# Meta ads setup — 2026-11-20

What the site sends to Meta, and the steps someone with access to Meta Business Manager must do.

## What the code does

**Pixel (browser):** PageView, ViewContent, Search, AddToCart, InitiateCheckout, CompleteRegistration and Purchase.

**Conversions API (server):** AddToCart, CompleteRegistration and Purchase.
- Shiprocket Checkout orders send their Purchase when Shiprocket's order webhook arrives (`src/server/services/shiprocketOrderImport.ts`). It carries the real order total.
- Before this fix, those orders sent no server Purchase at all, and the browser Purchase had a value of ₹0.

**Counting each sale once:**
- The browser and the server both send the event ID `purchase_<checkout session id>`, so Meta counts the pair as one sale.
- If the shopper closes the checkout window instead of reaching `/checkout-success`, the browser event still fires once the site sees the order (`useCheckoutCleanupWatcher`).

**Matching to ad clicks:**
- The pixel's `_fbp` / `_fbc` cookies are forwarded to the API in `x-meta-fbp` / `x-meta-fbc` headers. The API is on another domain and can't read those cookies.
- They're saved with the checkout, along with the shopper's IP and browser.
- The server event also sends hashed phone (with +91), name, city, PIN code and country, plus email and a hashed account ID when known.

**Catalog feed:**
- URL: `https://madalsacouture.com/feeds/meta-catalog.xml` (on the current preview: `https://madalsacouture.vercel.app/feeds/meta-catalog.xml`).
- One item per published product. Each item's `id` is the product's database ID, which is the same ID the pixel sends as `content_ids`. Don't change it.
- Price is the MRP, the sale price is the selling price, and stock is live (cached up to 15 minutes).

## Steps (Meta Business Manager)

1. **Render environment:** check that `META_PIXEL_ID` and `META_ACCESS_TOKEN` are set. Without the token the server sends nothing and logs `[MetaCAPI] Skipping`.
2. **Events Manager → Test events:**
   - Set `META_TEST_EVENT_CODE` on Render.
   - Place one real COD order through the site.
   - Check that Purchase shows from both **Browser** and **Server**, marked as deduplicated, with the right value.
   - Then remove `META_TEST_EVENT_CODE`.
3. **Events Manager → Overview:** after a few days of traffic, check the **Event Match Quality** score for Purchase and AddToCart.
4. **Commerce Manager → Catalog → Data sources → Data feed:**
   - Add the feed URL as a scheduled feed (daily or hourly).
   - Connect the catalog to the pixel.
   - Check **Events → Matched content IDs** (it should be close to 100%).
5. **Ads:** catalog / Advantage+ catalog ads can now use this catalog.

## Speed (measured 2026-11-20)

- **Product API on Render:** 0.7–2.3 s per request live, versus 0.03 s locally on the same code. Only 3 database queries are made per request; the variation points at the Render free plan's small CPU share.
  - Biggest single fix: a paid Render instance (Starter) in Singapore, the region nearest the Turso database in Mumbai.
  - The Render region couldn't be checked from here.
- **Product page:** the main photo is now preloaded from the server HTML, so it downloads in parallel with the app instead of after it. The API host is preconnected.
- **PageSpeed on the live home page (before these fixes):** mobile 64, desktop 24.
  - Desktop downloaded 48.9 MB and had a layout shift (CLS) of 0.951.
  - Mobile had an LCP of 13.0 s.
- **Fixed:**
  - **Video-card covers:** they were raw PNGs of about 1.2 MB each; now they're resized WebP of about 40 KB.
  - **Video-card videos:** they played the raw 5–10 MB uploads, some of them `.mov`. They now play 480 px MP4s of 2–3.5 MB; the popup player uses 1080 px.
  - **Desktop layout jump:** the announcement bar and the hero banner now hold their space while loading. Measured locally: CLS 0.650 → 0.013 at 1350×940, and 0.000 at 1366×768.
  - **llms.txt:** a real `/llms.txt` was added (the live site returned the HTML app there). The robots.txt error is fixed by the SEO work.
- **Still to do:** re-run https://pagespeed.web.dev on the home page and a product page after deploy.
