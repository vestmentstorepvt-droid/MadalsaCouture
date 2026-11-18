/**
 * Compare every read endpoint of the old Express backend with the new app.
 *
 *   OLD_API=http://localhost:5000 NEW_API=http://localhost:3000 npm run compare:api
 *
 * Both must run on the same data (old: MongoDB restored from a backup, new:
 * the same backup imported with `npm run db:import`) and share JWT secrets,
 * so one signed token works on both. Exits non-zero when any response differs.
 */
import jwt from "jsonwebtoken";
import { client } from "../src/db/client";

const OLD = process.env.OLD_API || "http://localhost:5000";
const NEW = process.env.NEW_API || "http://localhost:3000";
const SECRET = process.env.JWT_ACCESS_SECRET;

// Fields that legitimately change between two otherwise identical reads.
const VOLATILE = new Set(["updatedAt", "updated_at", "lastLoginAt", "serverTime", "generatedAt", "timestamp"]);

type Json = any;

async function rows(sql: string): Promise<Json[]> {
  const r = await client().execute(sql);
  return r.rows.map((row) => JSON.parse(String(row.doc)));
}

function diff(a: Json, b: Json, path = "", out: string[] = []): string[] {
  if (out.length > 8) return out;
  if (a === b) return out;
  if (typeof a !== typeof b || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${path || "(root)"}: ${JSON.stringify(a)?.slice(0, 120)} ≠ ${JSON.stringify(b)?.slice(0, 120)}`);
    return out;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) out.push(`${path}: length ${a.length} ≠ ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (typeof a === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (VOLATILE.has(k)) continue;
      if (!(k in a)) out.push(`${path}.${k}: missing in old`);
      else if (!(k in b)) out.push(`${path}.${k}: missing in new`);
      else diff(a[k], b[k], `${path}.${k}`, out);
    }
    return out;
  }
  out.push(`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  return out;
}

async function call(base: string, path: string, token?: string) {
  const res = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const text = await res.text();
  let body: Json = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON (CSV etc.) */
  }
  return { status: res.status, body };
}

async function main() {
  if (!SECRET) throw new Error("Set JWT_ACCESS_SECRET (same value both servers use).");
  const users = await rows(`SELECT doc FROM users`);
  const admin = users.find((u) => u.role === "ADMIN");
  const orders = await rows(`SELECT doc FROM orders`);
  const customer = users.find((u) => u._id === orders[0]?.userId) || users.find((u) => u.role === "USER");
  const adminToken = jwt.sign({ id: admin._id, role: "ADMIN" }, SECRET, { expiresIn: "15m" });
  const userToken = jwt.sign({ id: customer._id, role: "USER" }, SECRET, { expiresIn: "15m" });

  const [product] = await rows(`SELECT doc FROM products WHERE json_extract(doc,'$.status')='published' LIMIT 1`);
  const [variant] = await rows(`SELECT doc FROM variants LIMIT 1`);
  const [category] = await rows(`SELECT doc FROM categories LIMIT 1`);
  const [collection] = await rows(`SELECT doc FROM collections LIMIT 1`);
  const [page] = await rows(`SELECT doc FROM static_pages LIMIT 1`);
  const [banner] = await rows(`SELECT doc FROM banners LIMIT 1`);
  const order = orders[0];
  const userOrder = orders.find((o) => o.userId === customer._id) || order;

  const publicPaths = [
    "/api/v1/products",
    "/api/v1/products?page=2&limit=5",
    "/api/v1/products?sort=basePrice:asc",
    "/api/v1/products?sort=title:desc&limit=50",
    "/api/v1/products?search=anarkali",
    `/api/v1/products?category=${category?.slug}`,
    `/api/v1/products/${product.slug}`,
    `/api/v1/products/${product._id}/variants`,
    `/api/v1/products/${product._id}/comments`,
    "/api/v1/categories",
    "/api/v1/categories/tree",
    `/api/v1/categories/${category?.slug}`,
    "/api/v1/collections",
    `/api/v1/collections/${collection?.slug}`,
    "/api/v1/tags",
    "/api/v1/cms/hero",
    "/api/v1/cms/announcement-bar",
    `/api/v1/cms/banners/${banner?.placement ?? "festive"}`,
    "/api/v1/cms/static-pages",
    `/api/v1/cms/static-pages/${page?.slug}`,
    "/api/v1/cms/about-us",
    "/api/v1/cms/contact",
    "/api/v1/cms/collections-showcase",
    "/api/v1/cms/featured-sections",
    "/api/v1/cms/video-cards",
    "/api/fastrr/products",
    "/api/fastrr/collections",
    `/api/fastrr/products?collection_id=${collection?._id}`,
    "/api/v1/does-not-exist",
  ];

  const customerPaths = [
    "/api/v1/auth/me",
    "/api/v1/addresses",
    "/api/v1/wishlist",
    "/api/v1/cart",
    "/api/v1/orders",
    `/api/v1/orders/${userOrder._id}`,
  ];

  const adminPaths = [
    "/api/v1/admin/products",
    `/api/v1/admin/products/${product._id}`,
    `/api/v1/admin/products/${product._id}/variants`,
    `/api/v1/admin/variants/${variant._id}`,
    "/api/v1/admin/categories",
    `/api/v1/admin/categories/${category?._id}`,
    "/api/v1/admin/collections",
    `/api/v1/admin/collections/${collection?._id}`,
    "/api/v1/admin/tags",
    "/api/v1/admin/coupons",
    "/api/v1/admin/orders",
    `/api/v1/admin/orders/${order._id}`,
    "/api/v1/admin/exchanges",
    "/api/v1/admin/inventory",
    `/api/v1/admin/inventory/${variant._id}/log`,
    "/api/v1/admin/cms/hero",
    "/api/v1/admin/cms/announcement-bar",
    "/api/v1/admin/cms/banners",
    "/api/v1/admin/cms/static-pages",
    "/api/v1/admin/cms/about-us",
    "/api/v1/admin/cms/contact",
    "/api/v1/admin/cms/contact/inquiries",
    "/api/v1/admin/cms/collections-showcase",
    "/api/v1/admin/cms/featured-sections",
    "/api/v1/admin/cms/video-cards",
    "/api/v1/admin/media",
    "/api/v1/admin/media?page=2&limit=10",
    "/api/v1/admin/dashboard",
    "/api/v1/admin/reports/sales",
    "/api/v1/admin/reports/inventory",
    "/api/v1/admin/reports/customers",
    "/api/v1/admin/notifications/templates",
    "/api/v1/admin/notifications/logs",
    "/api/v1/admin/alerts",
    "/api/v1/admin/profile",
    "/api/v1/admin/users",
    `/api/v1/admin/users/${customer._id}`,
  ];

  let failures = 0;
  const check = async (path: string, token?: string, label = "public") => {
    const [a, b] = await Promise.all([call(OLD, path, token), call(NEW, path, token)]);
    const problems = a.status !== b.status ? [`status ${a.status} ≠ ${b.status}`] : diff(a.body, b.body);
    if (problems.length) {
      failures++;
      console.log(`✗ ${label.padEnd(8)} ${path}`);
      for (const p of problems.slice(0, 8)) console.log(`    ${p}`);
    } else {
      console.log(`✓ ${label.padEnd(8)} ${path} (${a.status})`);
    }
  };

  for (const p of publicPaths) await check(p);
  for (const p of customerPaths) await check(p, userToken, "customer");
  for (const p of adminPaths) await check(p, adminToken, "admin");
  // Auth failures must look identical too.
  await check("/api/v1/cart", undefined, "no-auth");
  await check("/api/v1/admin/products", userToken, "forbid");

  console.log(failures ? `\n${failures} endpoint(s) differ.` : "\nAll endpoints match.");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
