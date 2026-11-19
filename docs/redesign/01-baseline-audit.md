# Frontend Police — Pass 1 baseline (before any change)

Date: 19 Nov 2026 · Branch: `redesign` (the old design stays untouched on `main`)
Inspected: local dev server on the local database, Chrome, 1920px desktop and 390px mobile (iframe harness,
because the browser window would not resize). Hero and announcement schedules were re-opened **in the local
database only** so they could be inspected.

## Reconnaissance

| Item | Finding |
|---|---|
| Framework | Next.js 16 (App Router) shell loading the original React SPA (`src/legacy-ui`, react-router 7) client-side |
| Styling | Tailwind v4, inline utility classes only. `styles/tailwind.css` is 11 lines — **no design tokens at all** |
| Size | 91 TSX files, ~28,700 lines. 55 routes (21 storefront/account, 22 admin, 7 auth, 5 policy/CMS) |
| Icons | `lucide-react` **and** `react-icons` (two icon libraries) |
| Fonts | None loaded. `font-serif` (73×) falls back to the OS serif (Georgia/Times); body falls back to the OS sans |

### Design-system debt, measured

| Signal | Count | Verdict |
|---|---:|---|
| Hard-coded hex colours in class names | **~1,300** across 40+ distinct values | No palette. Pink `#E85D88` (437×), gold `#D4AF37` (258×), five near-identical browns, nine near-identical creams, five beige borders |
| Greys | `slate` 1,800+, `stone` 130+, `gray` some | Three grey families mixed on the same screens |
| Radii | `xl` 368, `full` 233, `2xl` 198, `lg` 170, `3xl` 64, `[2rem]` 9, `md` 24, `rounded` 66 | Seven radii, no rule for which component gets which |
| Shadows | 9 sizes incl. pink-tinted and 120px-blur custom shadows | Elevation is decoration, not hierarchy |
| Gradients | 52 | Gold-glow buttons, brown-to-beige fills |
| Letter-spacing | 10 different `tracking-*` values on 229 uppercase labels | Every section invents its own eyebrow |

## Verdict per surface

### Header / navigation — 3/10
- **P1** Mobile menu button is `text-slate-200` on the cream bar when the page is at the top — practically invisible (`LandingNavbar.tsx:271`).
- **P1** "Shop" dropdown opens on hover only; no keyboard or touch path on desktop (`LandingNavbar.tsx:213-246`).
- **P1** Three header states (cream → hidden → dark brown 95% blur) that swap the text colour while scrolling. Reads as two different sites.
- **P2** Cart count badge is amber-on-brown 10px text; profile/cart icons have different hit areas (36px vs 28px).
- **P2** Announcement bar: gold fill, emoji icon, wraps to two lines at 390px.

### Home — 4/10
- **P1** Four different section-heading treatments on one page: brown spaced serif ("NEW COLLECTION"), navy serif with gold rule ("COLLECTION LIST", "BEST SELLERS"), gold mono eyebrow + serif ("OUR STORY"), gold pill badge.
- **P1** "Our Story" body copy is `font-light text-justify` (`OurStory.tsx:82,99`) — thin grey justified text creates rivers and fails comfortable contrast.
- **P2** Best-sellers grid of 7 items leaves a hole in the second row at 4 columns.
- **P2** Product cards: category eyebrow in 10px spaced grey, gold "20% OFF" chip, no struck-through MRP — discount without the original price.
- **P2** Video stories: horizontally cut-off cards with no scroll affordance.
- **P3** Hero banner image has a white strip along its top edge — this is in the uploaded CMS image, not the code. Content fix, reported to the owner.

### Product listing — 5/10
- **P2** Toolbar search is a small grey field inside a large rounded card; sort control is a native select with different radius.
- **P2** "NEW" + "% OFF" badges in both top corners compete with the photo.

### Product detail — 5/10
- **P1** Primary CTAs use two unrelated colours side by side (hot pink "Add to Cart", dark brown "Add to Wishlist").
- **P2** Six stacked bordered accordions with letter-spaced uppercase labels; the description box has a gold border while the others don't.
- **P2** Status pills (green "In Stock", blue "New Arrival", pink discount) — three colour systems in one row.

### Auth (login / signup) — 5/10
- **P1** Visually unrelated to the storefront: pink gradient button, grey-white page, no header — looks like a different product.

### Admin — not yet screenshotted (requires an admin session); source review shows the same hex/radius sprawl.

## Accessibility (code + visual)
- Invisible mobile menu button (above). Hover-only dropdown (above).
- `text-slate-400` used 332× for readable text (contrast 2.6:1 on white — fails AA).
- Many icon-only buttons have labels (good); focus styles mostly `focus:outline-none` with no replacement.

## Direction chosen by the owner
Full redesign now, following `DESIGN.md` (Vercel / Geist). Old design preserved on `main`.
