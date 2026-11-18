// Express-shaped request/response objects, so every ported controller keeps
// its original logic and produces byte-for-byte the same responses.

export type UploadedFile = {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type AuthUser = { id: string; role: string; email: string };

export type Req = {
  method: string;
  /** Path relative to the current router mount (like Express `req.path`). */
  path: string;
  /** Full path + query string as received. */
  originalUrl: string;
  url: string;
  baseUrl: string;
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
  rawBody: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  ip: string | null;
  user?: AuthUser;
  file?: UploadedFile;
  files?: UploadedFile[] | Record<string, UploadedFile[]>;
  get(name: string): string | undefined;
  /** Free-form per-request storage for middleware (validated data etc.). */
  locals: Record<string, any>;
};

export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none" | boolean;
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
};

export class Res {
  statusCode = 200;
  headers = new Headers();
  body: BodyInit | null = null;
  private _finished = false;
  private onDone: (() => void)[] = [];
  private finishListeners: (() => void | Promise<void>)[] = [];
  readonly cookieHeaders: string[] = [];

  get finished() {
    return this._finished;
  }
  set finished(value: boolean) {
    this._finished = value;
    if (value) for (const fn of this.onDone.splice(0)) fn();
  }

  /** Resolves once a response has been sent. */
  whenFinished(fn: () => void) {
    if (this._finished) fn();
    else this.onDone.push(fn);
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  set(name: string, value: string) {
    this.headers.set(name, value);
    return this;
  }

  setHeader(name: string, value: string) {
    return this.set(name, value);
  }

  getHeader(name: string) {
    return this.headers.get(name);
  }

  json(data: unknown) {
    if (!this.headers.has("content-type")) this.headers.set("content-type", "application/json; charset=utf-8");
    this.body = JSON.stringify(data);
    this.finished = true;
    return this;
  }

  send(data: unknown) {
    if (data !== null && typeof data === "object" && !(data instanceof Uint8Array)) return this.json(data);
    if (typeof data === "string" && !this.headers.has("content-type")) this.headers.set("content-type", "text/html; charset=utf-8");
    this.body = data as BodyInit;
    this.finished = true;
    return this;
  }

  write(chunk: string) {
    this.body = String(this.body ?? "") + chunk;
    return true;
  }

  end(chunk?: string) {
    if (chunk) this.write(chunk);
    this.finished = true;
    return this;
  }

  sendStatus(code: number) {
    this.statusCode = code;
    return this.send(String(code));
  }

  redirect(urlOrStatus: string | number, maybeUrl?: string) {
    const [code, url] = typeof urlOrStatus === "number" ? [urlOrStatus, maybeUrl!] : [302, urlOrStatus];
    this.statusCode = code;
    this.headers.set("location", url);
    this.body = `Found. Redirecting to ${url}`;
    this.finished = true;
    return this;
  }

  cookie(name: string, value: string, opts: CookieOptions = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path ?? "/"}`];
    if (opts.maxAge !== undefined) {
      parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
      parts.push(`Expires=${new Date(Date.now() + opts.maxAge).toUTCString()}`);
    } else if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
    if (opts.domain) parts.push(`Domain=${opts.domain}`);
    if (opts.httpOnly) parts.push("HttpOnly");
    if (opts.secure) parts.push("Secure");
    if (opts.sameSite) {
      const s = opts.sameSite === true ? "Strict" : opts.sameSite[0].toUpperCase() + opts.sameSite.slice(1);
      parts.push(`SameSite=${s}`);
    }
    this.cookieHeaders.push(parts.join("; "));
    return this;
  }

  clearCookie(name: string, opts: CookieOptions = {}) {
    return this.cookie(name, "", { ...opts, expires: new Date(1), maxAge: undefined });
  }

  /** Like `res.on('finish', fn)` — runs after the response is built. */
  on(event: "finish", fn: () => void | Promise<void>) {
    if (event === "finish") this.finishListeners.push(fn);
    return this;
  }

  async runFinish() {
    for (const fn of this.finishListeners) {
      try {
        await fn();
      } catch {
        /* finish listeners never affect the response */
      }
    }
  }

  toResponse(): Response {
    const headers = new Headers(this.headers);
    for (const c of this.cookieHeaders) headers.append("set-cookie", c);
    const noBody = this.statusCode === 204 || this.statusCode === 304;
    return new Response(noBody ? null : this.body, { status: this.statusCode, headers });
  }
}

export type Next = (err?: unknown) => void;
export type Handler = (req: Req, res: Res, next: Next) => unknown;
export type ErrorHandler = (err: any, req: Req, res: Res, next: Next) => unknown;
