import { parse as parseQuery } from "node:querystring";
import { after, type NextRequest } from "next/server";
import { ensureSchema } from "@/db/migrate";
import app from "@/server/app";
import { errorHandler } from "@/server/http/errors";
import { type Req, Res, type UploadedFile } from "@/server/http/types";

// Single entry point for every /api/* request. It builds Express-style
// req/res objects and runs them through the ported route table.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "no-referrer",
  "X-DNS-Prefetch-Control": "off",
  "X-Download-Options": "noopen",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
const allowAllOrigins = allowedOrigins.length === 0 || allowedOrigins.includes("*");
// Entries may contain "*" wildcards, e.g. https://madalsacouture-*-vestment-store.vercel.app
// (Vercel gives every deployment its own address). "*" never matches "." or "/".
const originPatterns = allowedOrigins
  .filter((o) => o !== "*" && o.includes("*"))
  .map((o) => new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^./]*")}$`));
const isAllowedOrigin = (origin: string) =>
  allowAllOrigins || allowedOrigins.includes(origin) || originPatterns.some((p) => p.test(origin));

/** express-mongo-sanitize: drop keys that start with `$` or contain `.`. */
function sanitize(value: any): any {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".")) delete value[key];
      else value[key] = sanitize(value[key]);
    }
  }
  return value;
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[k] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

async function readBody(request: NextRequest, headers: Record<string, string>) {
  const type = (headers["content-type"] || "").toLowerCase();
  let body: any = {};
  let rawBody = "";
  const uploads: UploadedFile[] = [];
  if (request.method === "GET" || request.method === "HEAD") return { body: {}, rawBody, uploads };

  if (type.startsWith("multipart/form-data")) {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") {
        if (key in body) body[key] = [].concat(body[key], value as any);
        else body[key] = value;
      } else {
        const buffer = Buffer.from(await value.arrayBuffer());
        uploads.push({ fieldname: key, originalname: value.name, mimetype: value.type || "application/octet-stream", size: buffer.length, buffer });
      }
    }
    return { body, rawBody, uploads };
  }

  rawBody = await request.text();
  if (!rawBody) return { body: {}, rawBody, uploads };
  if (type.includes("application/json") || type.includes("+json")) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw Object.assign(new Error("Unexpected token in JSON"), { statusCode: 400, code: "REQUEST_ERROR", type: "entity.parse.failed" });
    }
  } else if (type.includes("application/x-www-form-urlencoded")) {
    body = { ...parseQuery(rawBody) };
  }
  return { body, rawBody, uploads };
}

async function handle(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  const origin = headers.origin;

  const res = new Res();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.set(k, v);
  if (origin && isAllowedOrigin(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "true");
    res.set("Vary", "Origin");
  }
  if (request.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
    if (headers["access-control-request-headers"]) res.set("Access-Control-Allow-Headers", headers["access-control-request-headers"]);
    res.status(204).end();
    return res.toResponse();
  }

  const ip = (headers["x-forwarded-for"] || "").split(",")[0].trim() || headers["x-real-ip"] || null;
  const originalUrl = url.pathname + url.search;
  const req: Req = {
    method: request.method,
    path: url.pathname,
    originalUrl,
    url: originalUrl,
    baseUrl: "",
    params: {},
    query: sanitize({ ...parseQuery(url.search.slice(1)) }),
    body: {},
    rawBody: "",
    headers,
    cookies: parseCookies(request.headers.get("cookie")),
    ip,
    locals: {},
    get: (name: string) => headers[name.toLowerCase()],
  };

  try {
    await ensureSchema();
    const parsed = await readBody(request, headers);
    req.body = sanitize(parsed.body);
    req.rawBody = parsed.rawBody;
    req.locals.uploads = parsed.uploads;
  } catch (err) {
    errorHandler(err, req, res, () => undefined);
    return res.toResponse();
  }

  await new Promise<void>((resolve) => {
    res.whenFinished(resolve);
    app
      .handle(req, res, (err) => {
        if (!res.finished) {
          if (err) errorHandler(err, req, res, () => undefined);
          else res.status(404).json({ error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.url} not found.`, details: [] } });
        }
        resolve();
      })
      .catch((err) => {
        if (!res.finished) errorHandler(err, req, res, () => undefined);
        resolve();
      });
  });

  // Audit logs and other "after response" work (res.on('finish')) run after the
  // response is sent, like Express's 'finish' event.
  after(() => res.runFinish());
  return res.toResponse();
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS, handle as HEAD };
