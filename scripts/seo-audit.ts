// SEO check for every public URL: status, title, description, canonical, robots, H1 in the
// server HTML, JSON-LD validity, duplicates, and that the sitemap and robots.txt agree.
//
//   npx tsx scripts/seo-audit.ts [baseUrl] [productionHost]
//   e.g. npx tsx scripts/seo-audit.ts http://localhost:3000 madalsacouture.com
//
// The production host is sent as the Host header so the site answers as the real domain would.

import http from "node:http";
import https from "node:https";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");
const HOST = process.argv[3] || "madalsacouture.com";

type Result = { path: string; status: number; title: string; description: string; canonical: string; robots: string; h1: string; jsonLd: string[]; problems: string[] };

// node:http, because fetch() does not let us set the Host header.
const get = (path: string, host = HOST): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(url, { headers: { host, "user-agent": "seo-audit" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
const pick = (html: string, re: RegExp) => (html.match(re)?.[1] ?? "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

async function audit(path: string, expect: { status: number; index: boolean }): Promise<Result> {
  const { status, body } = await get(path);
  const r: Result = {
    path,
    status,
    title: pick(body, /<title>([^<]*)<\/title>/),
    description: pick(body, /<meta name="description" content="([^"]*)"/),
    canonical: pick(body, /<link rel="canonical" href="([^"]*)"/),
    robots: pick(body, /<meta name="robots" content="([^"]*)"/),
    h1: pick(body, /<h1[^>]*>([^<]*)<\/h1>/),
    jsonLd: [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]),
    problems: [],
  };
  if (status !== expect.status) r.problems.push(`status ${status}, expected ${expect.status}`);
  const indexed = !/noindex/.test(r.robots);
  if (indexed !== expect.index) r.problems.push(`robots "${r.robots || "(none)"}", expected ${expect.index ? "index" : "noindex"}`);
  if (expect.status === 200) {
    if (!r.title) r.problems.push("no <title>");
    if (expect.index) {
      if (!r.description || r.description.length < 50) r.problems.push(`weak description (${r.description.length} chars)`);
      if (r.description.length > 170) r.problems.push(`long description (${r.description.length} chars)`);
      if (r.canonical !== `https://${HOST}` && !r.canonical.startsWith(`https://${HOST}/`)) r.problems.push(`canonical "${r.canonical}"`);
      if (!r.h1) r.problems.push("no H1 in server HTML");
      if (/undefined|null|NaN|\[object/.test(r.title + r.description + r.canonical)) r.problems.push("undefined/null in metadata");
    }
  }
  for (const raw of r.jsonLd) {
    try {
      const ld = JSON.parse(raw);
      if (!ld["@context"] || !ld["@type"]) r.problems.push("JSON-LD without @context/@type");
      if (/undefined|NaN/.test(raw)) r.problems.push(`JSON-LD contains undefined/NaN (${ld["@type"]})`);
      if (ld["@type"] === "Product") {
        if (!ld.name || !ld.image?.length || !ld.offers) r.problems.push("Product JSON-LD missing name/image/offers");
        if (ld.offers && !(ld.offers.price > 0 || ld.offers.lowPrice > 0)) r.problems.push("Product offer without a price");
        if (ld.name !== r.h1) r.problems.push(`Product name "${ld.name}" ≠ H1 "${r.h1}"`);
      }
    } catch {
      r.problems.push("invalid JSON-LD");
    }
  }
  return r;
}

async function main() {
  const robots = await get("/robots.txt");
  const sitemap = await get("/sitemap.xml");
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const paths = urls.map((u) => new URL(u).pathname);
  const results: Result[] = [];
  const general: string[] = [];

  if (robots.status !== 200 || !/Sitemap: https:\/\//.test(robots.body)) general.push("robots.txt missing or without a Sitemap line");
  if (/Disallow: \/\s*$/m.test(robots.body)) general.push("robots.txt blocks the whole production site");
  const preview = await get("/robots.txt", "madalsacouture.vercel.app");
  if (!/Disallow: \/\s*$/m.test(preview.body)) general.push("preview host robots.txt does not block crawling");
  const previewPage = await get("/", "madalsacouture.vercel.app");
  if (!/<meta name="robots" content="noindex/.test(previewPage.body)) general.push("preview host pages are indexable");
  if (sitemap.status !== 200 || urls.length === 0) general.push("sitemap.xml missing or empty");
  if (urls.some((u) => !u.startsWith(`https://${HOST}/`))) general.push("sitemap has URLs on another host");

  for (const path of paths) results.push(await audit(path, { status: 200, index: true }));
  for (const path of ["/login", "/signup", "/cart", "/checkout", "/my-orders", "/admin/dashboard", "/user/dashboard", "/order-success/abc"])
    results.push(await audit(path, { status: 200, index: false }));
  for (const path of ["/no-such-page", "/product/no-such-product", "/collections/no-such-collection", "/pages/no-such-page", "/about/extra"])
    results.push(await audit(path, { status: 404, index: false }));

  // Every sitemap URL must be self-canonical; titles/descriptions must be unique.
  for (const r of results.filter((x) => paths.includes(x.path))) {
    if (r.canonical && new URL(r.canonical).pathname !== r.path) r.problems.push(`in sitemap but canonical is ${r.canonical}`);
  }
  const dupes = (key: "title" | "description") => {
    const seen = new Map<string, string[]>();
    for (const r of results.filter((x) => paths.includes(x.path))) seen.set(r[key], [...(seen.get(r[key]) || []), r.path]);
    return [...seen.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `duplicate ${key} "${k.slice(0, 60)}": ${v.join(", ")}`);
  };
  general.push(...dupes("title"), ...dupes("description"));

  const failed = results.filter((r) => r.problems.length);
  console.log(`Sitemap URLs: ${paths.length}   Routes checked: ${results.length}   Failing: ${failed.length}`);
  for (const r of results) console.log(`${r.problems.length ? "FAIL" : "PASS"} ${r.status} ${r.path}  —  ${r.title}${r.problems.length ? `\n     ${r.problems.join("\n     ")}` : ""}`);
  if (general.length) console.log(`\nSite-wide problems:\n  ${general.join("\n  ")}`);
  else console.log("\nSite-wide: robots.txt, sitemap, preview-host blocking and uniqueness all OK");
  process.exit(failed.length || general.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
