import { Redis } from "@upstash/redis";
import type { Handler, Req } from "../http/types";

// express-rate-limit compatible middleware. On Vercel many copies of the app
// run at once, so counts live in Upstash Redis (UPSTASH_REDIS_REST_URL/TOKEN);
// without it (local dev) an in-memory counter is used.

type Options = {
  windowMs?: number;
  max?: number;
  limit?: number;
  message?: unknown;
  statusCode?: number;
  skip?: (req: Req) => boolean;
  keyGenerator?: (req: Req) => string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
};

let redis: Redis | null | undefined;
function getRedis() {
  if (redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    redis = url && token ? new Redis({ url, token }) : null;
  }
  return redis;
}

const memory = new Map<string, { count: number; resetAt: number }>();
let limiterSeq = 0;

async function hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
  const r = getRedis();
  const now = Date.now();
  if (r) {
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const redisKey = `rl:${key}:${windowStart}`;
    const count = await r.incr(redisKey);
    if (count === 1) await r.pexpire(redisKey, windowMs);
    return { count, resetAt: windowStart + windowMs };
  }
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    memory.set(key, fresh);
    return fresh;
  }
  entry.count++;
  return entry;
}

export default function rateLimit(opts: Options = {}): Handler {
  const id = `l${limiterSeq++}`;
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.limit ?? opts.max ?? 5;
  return async (req, res, next) => {
    if (opts.skip?.(req)) return next();
    const key = `${id}:${opts.keyGenerator ? opts.keyGenerator(req) : req.ip ?? "unknown"}`;
    let state: { count: number; resetAt: number };
    try {
      state = await hit(key, windowMs);
    } catch {
      return next(); // a limiter outage must never take the shop down
    }
    if (opts.standardHeaders !== false) {
      res.set("RateLimit-Limit", String(max));
      res.set("RateLimit-Remaining", String(Math.max(0, max - state.count)));
      res.set("RateLimit-Reset", String(Math.max(0, Math.ceil((state.resetAt - Date.now()) / 1000))));
    }
    if (state.count > max) {
      res.status(opts.statusCode ?? 429);
      const message = opts.message ?? "Too many requests, please try again later.";
      return typeof message === "string" ? res.send(message) : res.json(message);
    }
    next();
  };
}
