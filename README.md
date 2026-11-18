# Madalsa Web

madalsacouture.com rebuilt as **one Next.js app** (TypeScript) on **Turso + Drizzle**, hosted on **Vercel**.
The website looks the same and every API behaves the same as the old I2K2 setup
(`Madalsa-frontend` + `Madalsa-backend`), which stays untouched until cutover.

| | Old (I2K2) | New (this repo) |
|---|---|---|
| Website | React (Vite), Nginx | Same React code, served by Next.js |
| API | Express + Mongoose | Same routes and responses, Next.js route handler |
| Database | MongoDB on the server | Turso (SQLite), free tier |
| Media | Cloudinary (through the server) | Images → Cloudinary, videos → Cloudflare R2, uploaded straight from the browser |
| Deploys | GitHub Actions → self-hosted runner | Vercel (preview per pull request, production on `main`) |
| Backups | Manual `mongodump` | Nightly GitHub Action → R2 |

## Run it locally

```bash
npm install
cp .env.example .env.local            # fill JWT secrets at minimum
npm run db:import -- ../db-backups/madalsa-YYYYMMDD-HHMMSS.tar.gz --replace   # load real data
npm run dev                           # http://localhost:3000
```

Without `TURSO_DATABASE_URL` the app uses a local SQLite file at `.data/madalsa.db`.

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` / `test` | Checks (also run in CI) |
| `npm run db:migrate` | Create tables + indexes (also runs automatically on first request) |
| `npm run db:import -- <file> [--replace]` | Load a `mongodump` backup (`.tar.gz`/folder) or a `db:backup` file (`.json.gz`) |
| `npm run db:backup [-- --upload-r2]` | Full backup to `backups/` (and R2) |
| `npm run compare:api` | Every read endpoint: old backend vs new app, diffed |
| `npm run compare:flows` | Sign-up, cart, addresses, admin edits: old vs new, diffed |
| `npm run test:concurrency` | 25 buyers for 5 units; must never oversell |

## How the code is organised

```
src/app/[[...slug]]/        every page → the original React site (loaded in the browser)
src/app/api/[...path]/      every /api/* request → src/server/app.ts
src/legacy-ui/              the original frontend src/, copied (only env access, asset paths and uploads changed)
src/server/app.ts           Express app.js, same mounts in the same order
src/server/http/            Express-compatible router, req/res, errors
src/server/{controllers,services,repositories,validators,routes,modules,…}
                            ported from the Express backend, logic unchanged (// @ts-nocheck for now)
src/server/lib/             mongoose/multer/rate-limit compatibility, storage (Cloudinary + R2)
src/server/models/          every model → its Turso table, with populate refs
src/db/                     Turso connection, Drizzle schema, document store, query/update/aggregate engine
scripts/                    import, backup, comparison and concurrency tests
```

**Data model.** Each MongoDB collection is one table: `id` (the original ObjectId) and `doc` (the document
exactly as the API returns it), with expression indexes on the fields used for lookups. `src/db/odm.ts`
offers the Mongoose calls the services use (`find().sort().populate().lean()`, `findOneAndUpdate`, `save()`,
`aggregate`, sessions…), so the business logic didn't have to be rewritten.

**Many shoppers at once.** Every write runs inside a Turso write transaction (writes are serialised by
SQLite), so stock checks, coupon limits and order numbers can't race. `npm run test:concurrency` proves it.
Rate limits are shared across Vercel instances through Upstash Redis.

## Deploying (all free tiers)

1. **GitHub** — create a Madalsa Couture organisation, push this repo there (client + you as owners).
2. **Turso** — create a database (region Mumbai `bom` if offered), then a token:
   `turso db create madalsa` · `turso db show madalsa --url` · `turso db tokens create madalsa`.
3. **Load the data** — locally with the Turso values in `.env.local`:
   `npm run db:import -- <latest mongodump .tar.gz> --replace`.
4. **Upstash** — create a free Redis database; copy the REST URL + token.
5. **Cloudflare R2** — create a bucket (e.g. `madalsa-media`), enable its public URL (or a custom domain like
   `media.madalsacouture.com`), create an API token with read/write. Add a CORS rule allowing `PUT` from
   `https://madalsacouture.com` (and your Vercel preview domain) so browsers can upload videos.
   Optionally a second bucket for backups.
6. **Vercel** — import the GitHub repo, framework Next.js, add every variable from `.env.example`.
   Keep the **same `JWT_*` secrets** as the old server so nobody gets logged out.
7. **GitHub Actions secrets** for the nightly backup: see `.github/workflows/backup.yml`.
8. **Test on the Vercel URL** (`*.vercel.app`) — browse, log in, add to cart, admin screens, an upload.

Vercel's free Hobby plan is for non-commercial use; the client can move to Pro later with no code changes.

## Cutover checklist

1. Announce a short quiet window; stop admin edits on the old site.
2. Fresh `mongodump` on the I2K2 server → `npm run db:import -- <dump> --replace` into Turso.
3. Point DNS for `madalsacouture.com` (and `www`) to Vercel; add both domains in Vercel.
4. Shiprocket: the catalog (`/api/fastrr/...`) and checkout URLs are on the same domain, so nothing changes;
   place one small test order and cancel/refund it.
5. Keep the I2K2 server running untouched for two weeks as a fallback (switch DNS back to roll back).

## Intentional differences from the old backend

- **Uploads**: new `POST /api/v1/admin/media/upload-url` + `/register` and `POST /api/v1/uploads/review-url`
  (direct-to-storage). Reviews accept already-uploaded files in `mediaUploads`. The old multipart endpoints
  still work for files under ~4 MB.
- **`availableStock`** always equals `stock − reservedStock`. The old admin stock adjustment left it stale
  (restocked items stayed "out of stock" to Shiprocket); the old code itself worked around this elsewhere.
- `utils/cmsBaseRouter.js` was not ported: it had a syntax error and was never used.
- Logs: Vercel Hobby keeps function logs for about an hour; admin actions are still recorded in `audit_logs`.
