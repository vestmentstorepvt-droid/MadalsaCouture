/**
 * Send the shop's products and collections to Shiprocket Checkout.
 *
 * Shiprocket Checkout only knows the products a custom site sends it (its "custom" webhooks).
 * Until a product is sent, a checkout containing it fails inside Shiprocket's window
 * ("Something went wrong"). Run this after adding or changing products.
 *
 *   npx tsx scripts/sync-shiprocket-catalog.ts [catalogBaseUrl] [--dry-run]
 *
 * catalogBaseUrl: the API server whose /api/fastrr feed to send
 *   (default: https://madalsacouture-g12t.onrender.com). Keys come from .env.local:
 *   SHIPROCKET_API_KEY and SHIPROCKET_SECRET_KEY. --dry-run only prints what would be sent.
 */
import crypto from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const base = (args.find((a) => !a.startsWith("--")) || "https://madalsacouture-g12t.onrender.com").replace(/\/+$/, "");
const apiKey = (process.env.SHIPROCKET_API_KEY || "").trim();
const secret = (process.env.SHIPROCKET_SECRET_KEY || "").trim();
if (!dryRun && (!apiKey || !secret)) throw new Error("SHIPROCKET_API_KEY and SHIPROCKET_SECRET_KEY must be set in .env.local");

const SHIPROCKET = "https://checkout-api.shiprocket.com/wh/v1/custom";

/** Read every page of a /api/fastrr feed. */
async function readFeed(kind: "products" | "collections") {
  const items: any[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${base}/api/fastrr/${kind}?page=${page}&limit=100`);
    if (!res.ok) throw new Error(`${kind} feed returned HTTP ${res.status}`);
    const data = (await res.json()).data;
    const batch = data[kind] || [];
    items.push(...batch);
    if (batch.length < 100 || items.length >= (data.total ?? 0)) break;
  }
  return items;
}

/** POST one item, signed the way Shiprocket checks it (HMAC-SHA256 of the body, base64). */
async function send(kind: "product" | "collection", item: any) {
  const body = JSON.stringify(item);
  const signature = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const res = await fetch(`${SHIPROCKET}/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey, "X-Api-HMAC-SHA256": signature },
    body,
  });
  const text = await res.text();
  return { ok: res.ok && /"ok"\s*:\s*true/.test(text), status: res.status, text: text.slice(0, 200) };
}

async function main() {
  const products = await readFeed("products");
  const collections = await readFeed("collections");
  const noSizes = products.filter((p) => !(p.variants || []).length);
  console.log(`Feed ${base}: ${products.length} products, ${collections.length} collections.`);
  if (noSizes.length) console.log(`Warning: ${noSizes.length} product(s) have no sizes and can't be bought: ${noSizes.map((p) => p.title).join(", ")}`);

  if (dryRun) {
    console.log("Dry run: nothing sent.");
    return 0;
  }

  let failed = 0;
  for (const c of collections) {
    const r = await send("collection", c);
    if (!r.ok) failed++, console.log(`Collection "${c.title}" failed: HTTP ${r.status} ${r.text}`);
  }
  for (const p of products) {
    const r = await send("product", p);
    if (!r.ok) failed++, console.log(`Product "${p.title}" failed: HTTP ${r.status} ${r.text}`);
  }
  console.log(`Sent ${collections.length} collections and ${products.length} products to Shiprocket; ${failed} failed.`);
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
