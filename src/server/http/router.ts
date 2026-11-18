import type { ErrorHandler, Handler, Next, Req, Res } from "./types";

// A faithful port of Express's routing: layers run in mount order, `router.use`
// middleware runs for every path under its prefix (even ones that end in a
// 404), params can merge from parent mounts, and async errors go to `next`.

type Layer =
  | { kind: "use"; regex: RegExp; keys: string[]; splats: string[]; handlers: (Handler | Router)[] }
  | { kind: "route"; method: string; regex: RegExp; keys: string[]; splats: string[]; handlers: Handler[] };

function compilePath(path: string, end: boolean): { regex: RegExp; keys: string[]; splats: string[] } {
  const keys: string[] = [];
  const splats: string[] = [];
  const trimmed = path === "/" ? "" : path.replace(/\/+$/, "");
  const pattern = trimmed
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment.startsWith(":")) {
        keys.push(segment.slice(1));
        return "([^/]+?)";
      }
      if (segment.startsWith("*")) {
        // Express 5 splat (`/*publicId`): one or more segments, delivered as an array.
        keys.push(segment.slice(1));
        splats.push(segment.slice(1));
        return "(.+?)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  const source = end ? `^${pattern}/?$` : `^${pattern}(?=/|$)`;
  return { regex: new RegExp(source, "i"), keys, splats };
}

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export class Router {
  private layers: Layer[] = [];
  constructor(private options: { mergeParams?: boolean } = {}) {}

  use(...input: any[]) {
    // Express accepts nested arrays of middleware (express-validator chains).
    const args = input.flat(Infinity) as (string | Handler | Router)[];
    const path = typeof args[0] === "string" ? (args.shift() as string) : "/";
    const { regex, keys, splats } = compilePath(path, false);
    this.layers.push({ kind: "use", regex, keys, splats, handlers: args as (Handler | Router)[] });
    return this;
  }

  private route(method: string, path: string, input: any[]) {
    const handlers = input.flat(Infinity) as Handler[];
    const { regex, keys, splats } = compilePath(path, true);
    this.layers.push({ kind: "route", method, regex, keys, splats, handlers });
    return this;
  }

  get(path: string, ...h: any[]) {
    return this.route("GET", path, h);
  }
  post(path: string, ...h: any[]) {
    return this.route("POST", path, h);
  }
  put(path: string, ...h: any[]) {
    return this.route("PUT", path, h);
  }
  patch(path: string, ...h: any[]) {
    return this.route("PATCH", path, h);
  }
  delete(path: string, ...h: any[]) {
    return this.route("DELETE", path, h);
  }
  all(path: string, ...h: any[]) {
    return this.route("ALL", path, h);
  }

  /** Dispatch `req` through this router; calls `done` when nothing handled it (or with an error). */
  async handle(req: Req, res: Res, done: Next): Promise<void> {
    const parentParams = req.params;
    const parentPath = req.path;
    const parentBase = req.baseUrl;
    let index = 0;

    const restore = () => {
      req.params = parentParams;
      req.path = parentPath;
      req.baseUrl = parentBase;
    };

    const next = async (err?: unknown): Promise<void> => {
      if (res.finished) return;
      if (err === "router") {
        restore();
        return done();
      }
      while (index < this.layers.length) {
        const layer = this.layers[index++];
        const match = layer.regex.exec(parentPath);
        if (!match) continue;
        if (layer.kind === "route" && layer.method !== "ALL" && layer.method !== req.method && !(layer.method === "GET" && req.method === "HEAD")) continue;
        if (err && layer.kind === "route") continue;

        const params: Record<string, any> = this.options.mergeParams ? { ...parentParams } : {};
        layer.keys.forEach((k, i) => {
          params[k] = layer.splats.includes(k) ? match[i + 1].split("/").map(decode) : decode(match[i + 1]);
        });
        req.params = params;

        if (layer.kind === "use") {
          const consumed = match[0];
          req.baseUrl = parentBase + consumed;
          req.path = parentPath.slice(consumed.length) || "/";
          if (!req.path.startsWith("/")) req.path = "/" + req.path;
        } else {
          req.baseUrl = parentBase;
          req.path = parentPath;
        }

        return runHandlers(layer.handlers, err, async (e) => {
          req.baseUrl = parentBase;
          req.path = parentPath;
          req.params = parentParams;
          await next(e);
        });
      }
      restore();
      return done(err);
    };

    const runHandlers = async (handlers: (Handler | Router)[], err: unknown, after: (e?: unknown) => Promise<void>) => {
      let i = 0;
      const step = async (e?: unknown): Promise<void> => {
        if (res.finished) return;
        if (e === "route") return after();
        if (i >= handlers.length) return after(e);
        const h = handlers[i++];
        if (h instanceof Router) {
          if (e) return step(e);
          return h.handle(req, res, (x) => step(x));
        }
        const isErrorHandler = h.length === 4;
        if (Boolean(e) !== isErrorHandler) return step(e);
        let called = false;
        const nextFn: Next = (x) => {
          called = true;
          void step(x);
        };
        try {
          const result = isErrorHandler ? (h as unknown as ErrorHandler)(e, req, res, nextFn) : h(req, res, nextFn);
          if (result && typeof (result as Promise<unknown>).then === "function") await result;
        } catch (thrown) {
          if (!called) return step(thrown);
        }
      };
      await step(err);
    };

    await next();
  }
}
