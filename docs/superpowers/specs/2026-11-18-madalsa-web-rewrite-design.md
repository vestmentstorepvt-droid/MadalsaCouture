# Madalsa Web — Rewrite Design

Date: 18 Nov 2026 · Owner: Saransh Tiwari (Kapivic Core)

## Goal

Rebuild madalsacouture.com as one Next.js (TypeScript) app on Drizzle + Turso, hosted on Vercel,
**without changing the design or any API**. The live site (I2K2: `Madalsa-backend` + `Madalsa-frontend`)
is not touched until cutover.

## Constraints

- Same look: the current React website is copied in unchanged.
- Same APIs: every path, method, request body, response body (`{ success, data, … }`, `_id`, `__v`,
  nested objects), status code and error shape stays identical. Existing IDs and password hashes are kept.
- Many shoppers at once: stock, order numbers, coupon limits and webhooks are safe under concurrency.
- Free tiers only: Vercel Hobby, Turso, Upstash Redis, Cloudflare R2, Cloudinary, GitHub Actions.
  The client can upgrade any of them later without code changes.

## Architecture

```
madalsa-web/
├── src/app/[[...slug]]/page.tsx   loads the copied React site in the browser (no SSR)
├── src/app/api/[...path]/route.ts one entry point for every /api/v1/* and /api/fastrr/* request
├── src/legacy-ui/                 the current frontend src/, copied (only env access + asset imports adjusted)
├── src/server/http/               router, request context, middleware (auth, admin, rate limit, audit), errors
├── src/server/modules/<area>/     routes + services + validators per area, ported from Express
├── src/db/                        Drizzle schema, Turso connection, document store
└── scripts/                       MongoDB-backup import, API comparison, concurrency test, backup
```

### Routing

A single catch-all route handler dispatches to a route table that mirrors the Express mount order
(`app.js`) exactly, so matching precedence is unchanged. Route definitions read like Express:
`r.get('/api/v1/products/:slug', handler)`, with the same middleware chain per route.

### Data model (implementation decision)

The Section 2 sketch proposed fully relational tables. To guarantee byte-for-byte identical responses
across 30+ collections with deeply nested shapes, each MongoDB collection becomes **one Drizzle table
storing the document as JSON** plus generated/indexed columns for every field we filter, sort or keep
unique on (slug, email, sku, productId, userId, orderNumber, status, isDeleted, createdAt, …):

| Column | Purpose |
|---|---|
| `id` text PK | the original ObjectId hex — links, orders and carts keep working |
| `doc` JSON | the full document exactly as MongoDB returned it |
| expression indexes on `json_extract(doc, …)` | fast lookups, unique constraints |

A small document store (`src/db/store.ts`) offers Mongo-style `find / findOne / insert / update / count`
with filters compiled to SQL (`json_extract`, `json_each` for arrays) where safe, and exact MongoDB
semantics in JavaScript otherwise (`src/db/query.ts`, `update.ts`, `aggregate.ts`).

**As built:** on top of the store, `src/db/odm.ts` reproduces the Mongoose API the services use
(chainable queries, `populate`, `save()`, `findOneAndUpdate`, `aggregate`, sessions, strict-mode field
dropping, sub-document defaults). The 140 backend files were then ported mechanically (CommonJS → ES
modules, `// @ts-nocheck`) with their logic unchanged, instead of being re-typed by hand — the safest way to
keep every API identical. Files can be typed one at a time later.

### Concurrency

| Risk | Mechanism |
|---|---|
| Overselling | single conditional `UPDATE … WHERE availableStock >= qty` (atomic in SQLite) |
| Duplicate order numbers | counter row incremented with `UPDATE … RETURNING` |
| Coupon over-use | conditional increment against `usageLimitTotal` |
| Partial orders | order + items + stock + coupon in one `db.batch()` transaction |
| Duplicate webhooks | processed-event table with unique event id |
| Rate limits across instances | Upstash Redis (in-memory fallback in development) |

### Auth

Same JWT access (15m) + refresh (7d) tokens, same secrets format, bcrypt hashes imported unchanged,
Google ID-token sign-in, email verification, password reset, account lockout.

### Media uploads

Vercel caps request bodies at 4.5 MB. Uploads go **directly from the browser** to storage using a
short-lived signature from `POST /api/v1/admin/media/upload-url` (and the review equivalent):
images → Cloudinary (keeps `f_auto,q_auto`), videos → Cloudflare R2. The browser then registers the
file with the existing create endpoint. Only the upload components change.

### Errors and logs

Same error JSON. Admin mutations keep being written to `audit_logs` (as before). Server errors go to
Vercel's function logs, which the Hobby plan keeps for about an hour.

## Phases (all delivered in this build)

1. Foundation: project, copied UI, schema, import script, store, router, auth.
2. Storefront APIs: products, variants, categories, collections, tags, CMS reads, comments, fastrr catalog.
3. Shopping: cart, wishlist, addresses, coupons, checkout token, orders, webhooks, emails, Meta CAPI, exchanges.
4. Admin APIs: all admin modules, media library, notifications, alerts, dashboard, reports, users.
5. Cutover kit: comparison script, concurrency test, nightly backup workflow, deployment guide.

## Testing

- `scripts/compare-api.ts`: calls each endpoint on the old backend and the new app (same data) and diffs JSON.
- `scripts/concurrency-test.ts`: N parallel buyers for the last unit; exactly one succeeds, stock never < 0.
- Vitest unit tests for the store's filter compiler, tokens and stock logic.

## Verification results (18 Nov 2026, local, same backup in both systems)

- `compare:api`: every read endpoint tested (public, customer, admin) identical, except data that changed in the old local database after
  the backup (one extra sign-up) and the order of tied prices (unspecified in MongoDB too).
- `compare:flows`: every write step identical, except `availableStock` after an admin stock adjustment
  (deliberate fix, see README).
- `test:concurrency`: 25 parallel buyers for 5 units → 5 succeed, 20 refused, stock 0; 30 parallel restocks → 30.
- Production build, type check, lint (0 errors) and unit tests pass.
