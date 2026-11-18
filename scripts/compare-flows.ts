/**
 * Run the same write flows (sign-up, login, cart, addresses, wishlist, admin
 * edits) against the old backend and the new app, and compare responses after
 * replacing values that are naturally different (new ids, timestamps, tokens).
 *
 *   OLD_API=http://localhost:5000 NEW_API=http://localhost:3000 npx tsx scripts/compare-flows.ts
 *
 * Uses throwaway data (unique emails/slugs per run). Never point it at production.
 */
import jwt from "jsonwebtoken";
import { client } from "../src/db/client";

const OLD = process.env.OLD_API || "http://localhost:5000";
const NEW = process.env.NEW_API || "http://localhost:3000";
const SECRET = process.env.JWT_ACCESS_SECRET!;

type Json = any;
const ID = /^[0-9a-f]{24}$/;
const DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const JWT = /^ey[\w-]+\.[\w-]+\.[\w-]+$/;

function normalize(v: Json, run: string): Json {
  if (typeof v === "string") {
    if (ID.test(v)) return "<id>";
    if (DATE.test(v)) return "<date>";
    if (JWT.test(v)) return "<jwt>";
    if (/^9\d{9}$/.test(v)) return "<phone>";
    return v.split(run).join("<run>");
  }
  if (Array.isArray(v)) return v.map((x) => normalize(x, run));
  if (v && typeof v === "object") {
    const out: Json = {};
    for (const k of Object.keys(v).sort()) out[k] = normalize(v[k], run);
    return out;
  }
  return v;
}

function diff(a: Json, b: Json, path = "", out: string[] = []): string[] {
  if (out.length > 8 || JSON.stringify(a) === JSON.stringify(b)) return out;
  if (typeof a !== typeof b || a === null || b === null || Array.isArray(a) !== Array.isArray(b) || typeof a !== "object") {
    out.push(`${path || "(root)"}: ${JSON.stringify(a)?.slice(0, 140)} ≠ ${JSON.stringify(b)?.slice(0, 140)}`);
    return out;
  }
  if (Array.isArray(a) && a.length !== b.length) out.push(`${path}: length ${a.length} ≠ ${b.length}`);
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) out.push(`${path}.${k}: missing in old`);
    else if (!(k in b)) out.push(`${path}.${k}: missing in new`);
    else diff(a[k], b[k], `${path}.${k}`, out);
  }
  return out;
}

class Session {
  token?: string;
  vars: Record<string, string> = {};
  constructor(readonly base: string) {}
  async call(method: string, path: string, body?: Json, token = this.token) {
    const res = await fetch(this.base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: Json = text;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return { status: res.status, body: json };
  }
}

async function main() {
  const run = `t${Date.now().toString(36)}`;
  const phoneFor = (side: string) => `9${String(Date.now()).slice(-8)}${side === "o" ? 1 : 2}`;
  const users = (await client().execute("SELECT doc FROM users")).rows.map((r) => JSON.parse(String(r.doc)));
  const admin = users.find((u) => u.role === "ADMIN");
  const adminToken = jwt.sign({ id: admin._id, role: "ADMIN" }, SECRET, { expiresIn: "15m" });
  const product = JSON.parse(String((await client().execute(`SELECT doc FROM products WHERE json_extract(doc,'$.status')='published' LIMIT 1`)).rows[0].doc));
  const variant = JSON.parse(String((await client().execute({ sql: `SELECT doc FROM variants WHERE json_extract(doc,'$.productId')=? LIMIT 1`, args: [product._id] })).rows[0].doc));

  // Each side gets its own email/slug so the runs don't collide (old & new have separate databases anyway).
  const steps: { name: string; run: (s: Session, side: string) => Promise<{ status: number; body: Json }> }[] = [
    { name: "register (weak password)", run: (s, side) => s.call("POST", "/api/v1/auth/register", { name: "Flow Test", email: `${run}${side}@example.com`, password: "weak" }) },
    {
      name: "register",
      run: async (s, side) => {
        const r = await s.call("POST", "/api/v1/auth/register", { name: "Flow Test", email: `${run}${side}@example.com`, password: "Test@12345", confirmPassword: "Test@12345", phone: phoneFor(side) });
        return r;
      },
    },
    { name: "register duplicate", run: (s, side) => s.call("POST", "/api/v1/auth/register", { name: "Flow Test", email: `${run}${side}@example.com`, password: "Test@12345", confirmPassword: "Test@12345", phone: "9" + String(Date.now()).slice(-9) }) },
    { name: "login wrong password", run: (s, side) => s.call("POST", "/api/v1/auth/login", { email: `${run}${side}@example.com`, password: "Wrong@12345" }) },
    {
      name: "login",
      run: async (s, side) => {
        const r = await s.call("POST", "/api/v1/auth/login", { email: `${run}${side}@example.com`, password: "Test@12345" });
        s.token = r.body?.data?.accessToken || r.body?.data?.tokens?.accessToken || r.body?.data?.token;
        s.vars.refresh = r.body?.data?.refreshToken || r.body?.data?.tokens?.refreshToken;
        return r;
      },
    },
    { name: "profile", run: (s) => s.call("GET", "/api/v1/auth/profile") },
    { name: "update profile", run: (s) => s.call("PUT", "/api/v1/auth/profile", { name: "Flow Tester" }) },
    { name: "refresh token", run: (s) => s.call("POST", "/api/v1/auth/refresh-token", { refreshToken: s.vars.refresh }) },
    { name: "empty cart", run: (s) => s.call("GET", "/api/v1/cart") },
    { name: "add to cart", run: (s) => s.call("POST", "/api/v1/cart/items", { productId: product._id, variantId: variant._id, quantity: 2, selectedSize: variant.size }) },
    { name: "add same again", run: (s) => s.call("POST", "/api/v1/cart/items", { productId: product._id, variantId: variant._id, quantity: 1, selectedSize: variant.size }) },
    {
      name: "update cart item",
      run: async (s) => {
        const cart = await s.call("GET", "/api/v1/cart");
        s.vars.item = cart.body?.data?.cart?.items?.[0]?._id || cart.body?.data?.items?.[0]?._id;
        return s.call("PATCH", `/api/v1/cart/items/${s.vars.item}`, { quantity: 4 });
      },
    },
    { name: "remove cart item", run: (s) => s.call("DELETE", `/api/v1/cart/items/${s.vars.item}`) },
    { name: "sync guest cart", run: (s) => s.call("POST", "/api/v1/cart/sync", { items: [{ productId: product._id, variantId: variant._id, quantity: 1 }] }) },
    { name: "clear cart", run: (s) => s.call("DELETE", "/api/v1/cart") },
    { name: "wishlist add", run: (s) => s.call("POST", `/api/v1/wishlist/${product._id}`) },
    { name: "wishlist list", run: (s) => s.call("GET", "/api/v1/wishlist") },
    { name: "wishlist remove", run: (s) => s.call("DELETE", `/api/v1/wishlist/${product._id}`) },
    { name: "address invalid", run: (s) => s.call("POST", "/api/v1/addresses", { name: "A" }) },
    {
      name: "address create",
      run: async (s) => {
        const r = await s.call("POST", "/api/v1/addresses", { name: "Flow Test", addressLine: "12 Test Road", city: "Bhopal", state: "Madhya Pradesh", pincode: "462001", phone: "9999999999", isDefault: true });
        s.vars.address = r.body?.data?.address?._id || r.body?.data?._id;
        return r;
      },
    },
    { name: "address update", run: (s) => s.call("PATCH", `/api/v1/addresses/${s.vars.address}`, { city: "Indore" }) },
    { name: "address list", run: (s) => s.call("GET", "/api/v1/addresses") },
    { name: "address delete", run: (s) => s.call("DELETE", `/api/v1/addresses/${s.vars.address}`) },
    { name: "coupon validate (missing)", run: (s) => s.call("POST", "/api/v1/coupons/validate", { code: "NOPE", cartTotal: 1000 }) },
    { name: "my orders", run: (s) => s.call("GET", "/api/v1/orders") },
    // Admin
    {
      name: "admin tag create",
      run: async (s, side) => {
        const r = await s.call("POST", "/api/v1/admin/tags", { name: `Flow ${run}${side}` }, adminToken);
        s.vars.tag = r.body?.data?.tag?._id || r.body?.data?._id;
        return r;
      },
    },
    { name: "admin tag duplicate", run: (s, side) => s.call("POST", "/api/v1/admin/tags", { name: `flow ${run}${side}` }, adminToken) },
    { name: "admin tag delete", run: (s) => s.call("DELETE", `/api/v1/admin/tags/${s.vars.tag}`, undefined, adminToken) },
    {
      name: "admin coupon create",
      run: async (s, side) => {
        const r = await s.call("POST", "/api/v1/admin/coupons", { code: `F${run}${side}`.toUpperCase(), type: "percentage", value: 10, minOrderValue: 0 }, adminToken);
        s.vars.coupon = r.body?.data?.coupon?._id || r.body?.data?._id;
        s.vars.couponCode = `F${run}${side}`.toUpperCase();
        return r;
      },
    },
    { name: "coupon validate", run: (s) => s.call("POST", "/api/v1/coupons/validate", { code: s.vars.couponCode, cartTotal: 5000, items: [{ productId: product._id, variantId: variant._id, quantity: 1, price: 5000 }] }) },
    { name: "admin coupon update", run: (s) => s.call("PATCH", `/api/v1/admin/coupons/${s.vars.coupon}`, { value: 15 }, adminToken) },
    { name: "admin coupon delete", run: (s) => s.call("DELETE", `/api/v1/admin/coupons/${s.vars.coupon}`, undefined, adminToken) },
    {
      name: "admin category create",
      run: async (s, side) => {
        const r = await s.call("POST", "/api/v1/admin/categories", { name: `Flow Cat ${run}${side}` }, adminToken);
        s.vars.category = r.body?.data?.category?._id || r.body?.data?._id;
        return r;
      },
    },
    { name: "admin category update", run: (s) => s.call("PATCH", `/api/v1/admin/categories/${s.vars.category}`, { description: "Updated" }, adminToken) },
    { name: "admin category delete", run: (s) => s.call("DELETE", `/api/v1/admin/categories/${s.vars.category}`, undefined, adminToken) },
    {
      name: "admin product create",
      run: async (s, side) => {
        const r = await s.call("POST", "/api/v1/admin/products", { title: `Flow Product ${run}${side}`, basePrice: 999, mrp: 1299 }, adminToken);
        s.vars.product = r.body?.data?.product?._id || r.body?.data?._id;
        return r;
      },
    },
    { name: "admin product update", run: (s) => s.call("PATCH", `/api/v1/admin/products/${s.vars.product}`, { shortDescription: "Short", flags: { isFeatured: true } }, adminToken) },
    {
      name: "admin variant create",
      run: async (s, side) => {
        const r = await s.call("POST", `/api/v1/admin/products/${s.vars.product}/variants`, { size: "M", color: "Red", fabric: "Silk", sku: `SKU-${run}${side}`, price: 999, stock: 5 }, adminToken);
        s.vars.variant = r.body?.data?.variant?._id || r.body?.data?._id;
        return r;
      },
    },
    { name: "admin stock adjust", run: (s) => s.call("PATCH", `/api/v1/admin/inventory/${s.vars.variant}/adjust`, { delta: 3, reasonCode: "adjustment", note: "flow" }, adminToken) },
    { name: "admin stock below zero", run: (s) => s.call("PATCH", `/api/v1/admin/inventory/${s.vars.variant}/adjust`, { delta: -100, reasonCode: "loss" }, adminToken) },
    { name: "admin publish without seo", run: (s) => s.call("PATCH", `/api/v1/admin/products/${s.vars.product}/status`, { status: "published" }, adminToken) },
    { name: "admin product delete", run: (s) => s.call("DELETE", `/api/v1/admin/products/${s.vars.product}`, undefined, adminToken) },
    {
      name: "admin banner create",
      run: async (s, side) => {
        const r = await s.call("POST", "/api/v1/admin/cms/banners", { placement: "festive", title: `Flow ${run}${side}`, imageUrl: "https://example.com/a.jpg" }, adminToken);
        s.vars.banner = r.body?.data?.banner?._id || r.body?.data?._id || r.body?.data?.document?._id;
        return r;
      },
    },
    { name: "admin banner delete", run: (s) => s.call("DELETE", `/api/v1/admin/cms/banners/${s.vars.banner}`, undefined, adminToken) },
    { name: "logout", run: (s) => s.call("POST", "/api/v1/auth/logout", { refreshToken: s.vars.refresh }) },
  ];

  const oldS = new Session(OLD);
  const newS = new Session(NEW);
  let failures = 0;
  for (const step of steps) {
    const a = await step.run(oldS, "o");
    const b = await step.run(newS, "n");
    const na = normalize(a.body, run).toString === undefined ? a.body : normalize(a.body, run);
    const nb = normalize(b.body, run);
    // Side markers ("o"/"n") inside generated names/codes are part of the run data.
    const strip = (x: Json) => JSON.parse(JSON.stringify(x).replace(/<run>(o|n)/gi, "<run>").replace(/<RUN>(O|N)/g, "<RUN>").replace(new RegExp(`F${run.toUpperCase()}(O|N)`, "g"), "<CODE>").replace(new RegExp(`${run}-(o|n)`, "g"), "<run>").replace(new RegExp(`${run} (o|n)`, "gi"), "<run>"));
    const problems = a.status !== b.status ? [`status ${a.status} ≠ ${b.status}`, ...diff(strip(na), strip(nb)).slice(0, 4)] : diff(strip(na), strip(nb));
    if (problems.length) {
      failures++;
      console.log(`✗ ${step.name}`);
      for (const p of problems.slice(0, 8)) console.log(`    ${p}`);
    } else console.log(`✓ ${step.name} (${a.status})`);
  }
  console.log(failures ? `\n${failures} step(s) differ.` : "\nAll flows match.");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
