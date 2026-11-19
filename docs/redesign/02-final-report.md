# Frontend Police — Final verdict (redesign branch)

Date: 19 Nov 2026 · Branch `redesign` (the old design is untouched on `main`) · Design system: `DESIGN.md` (Vercel / Geist)

**Inspection status:** Partially completed — storefront fully redesigned and verified; admin restyled through the design tokens plus a new sidebar, but not redesigned page by page.
**Four-pass status:** 4/4 run (see "Verification evidence" for how deep each went).
**Verdict: CONDITIONAL APPROVAL.** No known P0 left. The P1/P2 items under "Remaining" still need work.

## What changed

### Design system (one place: `src/legacy-ui/styles/tailwind.css`)
- Geist Sans + Geist Mono via `next/font` (no font was loaded before).
- Tokens: `canvas #fafafa`, `surface #fff`, `ink #171717`, `body`, `mute`, `faint`, `hairline`, and one brand accent
  (Madalsa rose darkened to `#c2255c` so it passes WCAG AA). All five grey families (slate/gray/stone/zinc/neutral)
  now map to one Geist ladder; `rose`/`pink` map to the accent ramp.
- Radius 6 / 12 / 16 / full, a single layered low-alpha shadow scale, 12px minimum text size.
- Shared classes: `.btn-primary` / `.btn-secondary` (pills), `.btn-sm` (6px), `.field`, `.field-label`, `.eyebrow`,
  `.section-title`, `.mesh-gradient` (the only decorative element). One visible focus ring for everything,
  `prefers-reduced-motion` respected.
- Two codemods: ~1,300 hard-coded hex colours → tokens; legacy patterns (uppercase serif headings, 10px spaced eyebrows,
  square uppercase buttons, gradients, sub-12px text) → the system.

### New shared components (`src/legacy-ui/components/ui/`)
`ProductCard` + `ProductGrid` + `ProductGridSkeleton`, `SectionHeader`, `EmptyState`.

### Home page — client's order
Banner (up to 4 slides, swipe + dots) → Video stories → New arrivals → Best sellers → Western wear → Ethnic wear
(each 6 products, 3 × 2, "View all") → Reviews & testimonials → Our story → Footer.
Rows come from the admin-managed collections `new-arrivals`, `best-seller`, `western-wear`, `ethnic-wear`.
(The banner/hero file was redesigned by a parallel session.)

### Header
Logo centred; Shop menu (all products, new arrivals, best sellers, every collection), New in, Best sellers, Our story,
Contact; search (drops a bar, goes to `/products?q=`), wishlist with count, account menu, cart with count.
Keyboard/click menus with Escape and outside-click to close. Mobile: menu + search left, logo centre, account + cart right.

### Pages
Shop, collection, product (gallery with thumbnails, breadcrumb, clear size selection, labelled quantity, accordions with
`aria-expanded`, related products), cart, checkout, order success, about, contact, policies, login/sign-up/password pages,
account pages (pattern pass), footer (four columns, socials, WhatsApp), admin sidebar (light chrome).

### API
One new read-only endpoint: `GET /api/v1/reviews/featured?limit=6` (recent 4–5★ reviews with text; author shown as first
name + initial). No existing API changed.

## Defects found and fixed (selection)
| Sev | Issue | Fix |
|---|---|---|
| P0 | About page "Explore Collections" button became black text on black after the colour mapping | `btn-primary` |
| P1 | Mobile menu button invisible on the cream header (`text-slate-200` on cream) | ink icon, 40px target |
| P1 | Shop dropdown hover-only (no keyboard/touch) | click/keyboard menu |
| P1 | Hero shows "Hero section is currently unavailable" to shoppers when no hero is scheduled (the live site does this today) | hidden instead |
| P1 | Product page: selected size indistinguishable (two near-identical greys) | selected = ink fill, `aria-pressed` |
| P1 | Four competing section-heading styles; auth pages looked like another product | one `SectionHeader`, auth on the system |
| P1 | Text in 246 places below 12px; `slate-400` body text at 2.6:1 contrast | 12px floor; grey ladder at AA |
| P2 | Discount shown without the original price; 7 items at 4 columns left a hole | `ProductCard` shows MRP + % off; full rows only |
| P2 | Justified thin body copy (Our story) | left-aligned 16/28 body |
| P2 | Quantity +/− and slider dots without labels; video row with no scroll affordance | labels, buttons, scroll controls |

## Remaining (not done — be explicit)
| Sev | Item |
|---|---|
| P1 | Admin pages: restyled through tokens and the sidebar only. ProductManagement, Media library, CMS editors, Notifications etc. were not redesigned individually. |
| P1 | Account pages (profile, orders, wishlist, addresses) got the pattern pass only; not viewed logged in as a customer. |
| P2 | Responsive checked at 1920px and 390px only (browser window could not be resized; 390px via an iframe). 768/1024/1280 not inspected. |
| P2 | `CartSideDrawer`, size-guide modal, lightbox, review form: pattern pass only, not visually checked. |
| P2 | Announcement bar colour is CMS data (currently gold). Change it in Admin → CMS → Announcement bar to ink `#171717`. |
| P3 | Some product photos have a white strip at the top (in the uploaded images, not code). |
| — | Legacy UI is excluded from ESLint (unchanged project setting), so UI code has no lint coverage. |

## Verification evidence
- Build: `next build` ✓ · Typecheck ✓ · Lint 0 errors · Unit tests 7/7 ✓.
- Browser (local dev server, local database copy, Chrome): home, shop, collection rows, product, cart (empty), checkout
  (empty), login, about, contact, admin dashboard / products / orders / CMS hero — desktop 1920px; home, product and shop
  at 390px.
- Console: no errors on fresh loads of home, product, shop, admin pages.
- Pass 1 baseline: `01-baseline-audit.md`. Pass 2: source sweep (tiny text, gradients, leftover headings) + fixes.
  Pass 3: visual re-review + console. Pass 4: final routes + full checks.
- A local-only test admin account exists in the local `.data` database (credentials in `.data/test-admin.txt`, gitignored).
  It is not in Turso or production.
