/**
 * Many requests at once against the same stock — the overselling scenario.
 *
 *   NEW_API=http://localhost:3000 JWT_ACCESS_SECRET=... npm run test:concurrency
 *
 * 1. A throwaway product + variant with 5 units.
 * 2. 25 parallel "take one unit" requests: exactly 5 must succeed, 20 must be
 *    refused, and stock must end at 0 (never negative).
 * 3. 30 parallel "+1" requests: stock must end at exactly 30 (no lost updates).
 * Cleans up after itself. Never run against production.
 */
import jwt from "jsonwebtoken";
import { client } from "../src/db/client";

const API = process.env.NEW_API || "http://localhost:3000";
const SECRET = process.env.JWT_ACCESS_SECRET!;

async function main() {
  const admin = (await client().execute(`SELECT doc FROM users WHERE json_extract(doc,'$.role')='ADMIN' LIMIT 1`)).rows.map((r) => JSON.parse(String(r.doc)))[0];
  const token = jwt.sign({ id: admin._id, role: "ADMIN" }, SECRET, { expiresIn: "15m" });
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(API + path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const run = Date.now().toString(36);
  const product = await call("POST", "/api/v1/admin/products", { title: `Concurrency ${run}`, basePrice: 100 });
  const productId = product.body?.data?.product?._id;
  const variant = await call("POST", `/api/v1/admin/products/${productId}/variants`, { size: "M", color: "Black", fabric: "Cotton", sku: `CC-${run}`, price: 100, stock: 5 });
  const variantId = variant.body?.data?.variant?._id;
  if (!productId || !variantId) throw new Error(`setup failed: ${JSON.stringify(product.body)} ${JSON.stringify(variant.body)}`);

  let ok = true;
  const stockNow = async () => (await call("GET", `/api/v1/admin/variants/${variantId}`)).body?.data?.variant;

  const takes = await Promise.all(Array.from({ length: 25 }, () => call("PATCH", `/api/v1/admin/inventory/${variantId}/adjust`, { delta: -1, reasonCode: "purchase" })));
  const won = takes.filter((r) => r.status === 200).length;
  const refused = takes.filter((r) => r.status === 409).length;
  const afterTakes = await stockNow();
  console.log(`25 buyers for 5 units → ${won} succeeded, ${refused} refused, stock now ${afterTakes.stock} (available ${afterTakes.availableStock})`);
  if (won !== 5 || refused !== 20 || afterTakes.stock !== 0 || afterTakes.availableStock !== 0) ok = false;

  const adds = await Promise.all(Array.from({ length: 30 }, () => call("PATCH", `/api/v1/admin/inventory/${variantId}/adjust`, { delta: 1, reasonCode: "found" })));
  const afterAdds = await stockNow();
  console.log(`30 parallel restocks of +1 → ${adds.filter((r) => r.status === 200).length} succeeded, stock now ${afterAdds.stock}`);
  if (afterAdds.stock !== 30) ok = false;


  await call("DELETE", `/api/v1/admin/variants/${variantId}`);
  await call("DELETE", `/api/v1/admin/products/${productId}`);
  console.log(ok ? "\nPASS: no overselling, no lost updates." : "\nFAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
