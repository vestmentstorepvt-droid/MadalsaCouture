// MongoDB query semantics evaluated in JavaScript.
//
// Documents are stored as the JSON MongoDB used to return (ObjectIds as hex
// strings, dates as ISO strings). Filters coming from the services may still
// contain Date objects or RegExps; they are normalised here so comparisons
// behave the way they did against MongoDB.

import { evalExpr } from "./aggregate";

export type Doc = Record<string, any>;
export type Filter = Record<string, any>;
export type SortSpec = Record<string, 1 | -1 | "asc" | "desc" | "ascending" | "descending">;

/** Convert filter/update values to their stored JSON form. */
export function normalizeValue(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && typeof value.toHexString === "function") return value.toHexString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object" && !(value instanceof RegExp)) {
    const out: Doc = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = normalizeValue(v);
    }
    return out;
  }
  return value;
}

/**
 * Values at a dotted path, traversing arrays the way MongoDB does:
 * `items.variantId` on `{ items: [{ variantId: 1 }, { variantId: 2 }] }` → [1, 2].
 * Returns `undefined` entries for missing paths so `$exists` can tell them apart.
 */
export function valuesAtPath(doc: any, path: string): any[] {
  const parts = path.split(".");
  let current: any[] = [doc];
  for (const part of parts) {
    const next: any[] = [];
    for (const value of current) {
      if (value === null || value === undefined) {
        next.push(undefined);
        continue;
      }
      if (Array.isArray(value)) {
        if (/^\d+$/.test(part)) {
          next.push(value[Number(part)]);
        } else {
          for (const element of value) {
            if (element && typeof element === "object" && !Array.isArray(element)) next.push(element[part]);
          }
          if (value.length === 0) next.push(undefined);
        }
      } else if (typeof value === "object") {
        next.push(value[part]);
      } else {
        next.push(undefined);
      }
    }
    current = next;
  }
  return current;
}

export function getPath(doc: any, path: string): any {
  let value = doc;
  for (const part of path.split(".")) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  return value;
}

export function setPath(doc: any, path: string, value: any) {
  const parts = path.split(".");
  let target = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (target[part] === null || target[part] === undefined || typeof target[part] !== "object") {
      target[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    target = target[part];
  }
  target[parts[parts.length - 1]] = value;
}

export function unsetPath(doc: any, path: string) {
  const parts = path.split(".");
  let target = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    target = target?.[parts[i]];
    if (target === null || target === undefined) return;
  }
  if (target && typeof target === "object") delete target[parts[parts.length - 1]];
}

function typeRank(v: any): number {
  if (v === undefined || v === null) return 1;
  if (typeof v === "number") return 2;
  if (typeof v === "string") return 3;
  if (typeof v === "object" && !Array.isArray(v)) return 4;
  if (Array.isArray(v)) return 5;
  if (typeof v === "boolean") return 8;
  return 10;
}

/** MongoDB-style ordering of two scalar values. */
export function compareValues(a: any, b: any): number {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (a === b) return 0;
  if (a === null || a === undefined) return 0;
  if (typeof a === "number" || typeof a === "string") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
  return JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return (a ?? null) === (b ?? null);
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  if (typeof a === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

/** Equality the way MongoDB applies it: a value matches an array that contains it. */
function equalsQuery(value: any, query: any): boolean {
  if (query instanceof RegExp) {
    if (Array.isArray(value)) return value.some((v) => typeof v === "string" && query.test(v));
    return typeof value === "string" && query.test(value);
  }
  if (query === null) return value === null || value === undefined;
  if (Array.isArray(value) && !Array.isArray(query)) return value.some((v) => deepEqual(v, query));
  if (Array.isArray(value) && Array.isArray(query)) return deepEqual(value, query) || value.some((v) => deepEqual(v, query));
  return deepEqual(value, query);
}

function anyValue(values: any[], test: (v: any) => boolean, expandArrays = true): boolean {
  for (const v of values) {
    if (expandArrays && Array.isArray(v)) {
      if (v.some((x) => test(x))) return true;
    } else if (test(v)) return true;
  }
  return false;
}

function toRegExp(pattern: any, options?: string): RegExp {
  if (pattern instanceof RegExp) return options ? new RegExp(pattern.source, options) : pattern;
  return new RegExp(String(pattern), options || "");
}

function isOperatorObject(q: any): boolean {
  return q && typeof q === "object" && !Array.isArray(q) && !(q instanceof RegExp) && Object.keys(q).length > 0 && Object.keys(q).every((k) => k.startsWith("$"));
}

function matchField(doc: Doc, path: string, query: any): boolean {
  const values = valuesAtPath(doc, path);
  if (!isOperatorObject(query)) {
    const q = normalizeValue(query);
    return values.some((v) => equalsQuery(v, q));
  }
  for (const [op, raw] of Object.entries(query)) {
    if (op === "$options") continue;
    const operand = op === "$regex" ? raw : normalizeValue(raw);
    let ok: boolean;
    switch (op) {
      case "$eq":
        ok = values.some((v) => equalsQuery(v, operand));
        break;
      case "$ne":
        ok = !values.some((v) => equalsQuery(v, operand));
        break;
      case "$in":
        ok = (operand as any[]).some((q) => values.some((v) => equalsQuery(v, q)));
        break;
      case "$nin":
        ok = !(operand as any[]).some((q) => values.some((v) => equalsQuery(v, q)));
        break;
      case "$gt":
        ok = anyValue(values, (v) => v !== undefined && v !== null && typeRank(v) === typeRank(operand) && compareValues(v, operand) > 0);
        break;
      case "$gte":
        ok = anyValue(values, (v) => v !== undefined && typeRank(v) === typeRank(operand) && compareValues(v, operand) >= 0);
        break;
      case "$lt":
        ok = anyValue(values, (v) => v !== undefined && v !== null && typeRank(v) === typeRank(operand) && compareValues(v, operand) < 0);
        break;
      case "$lte":
        ok = anyValue(values, (v) => v !== undefined && typeRank(v) === typeRank(operand) && compareValues(v, operand) <= 0);
        break;
      case "$exists":
        ok = operand ? values.some((v) => v !== undefined) : values.every((v) => v === undefined);
        break;
      case "$regex": {
        const re = toRegExp(raw, (query as any).$options);
        ok = anyValue(values, (v) => typeof v === "string" && re.test(v));
        break;
      }
      case "$size":
        ok = values.some((v) => Array.isArray(v) && v.length === operand);
        break;
      case "$all":
        ok = (operand as any[]).every((q) => values.some((v) => equalsQuery(v, q)));
        break;
      case "$elemMatch":
        ok = values.some((v) => Array.isArray(v) && v.some((el) => (el && typeof el === "object" ? matches(el, raw as Filter) : matchField({ v: el }, "v", raw))));
        break;
      case "$not":
        ok = !matchField(doc, path, raw instanceof RegExp ? { $regex: raw } : raw);
        break;
      default:
        throw new Error(`Unsupported query operator ${op}`);
    }
    if (!ok) return false;
  }
  return true;
}

/** Does `doc` satisfy the MongoDB filter? */
export function matches(doc: Doc, filter: Filter = {}): boolean {
  for (const [key, query] of Object.entries(filter)) {
    if (query === undefined) continue;
    if (key === "$or") {
      if (!(query as Filter[]).some((f) => matches(doc, f))) return false;
    } else if (key === "$and") {
      if (!(query as Filter[]).every((f) => matches(doc, f))) return false;
    } else if (key === "$nor") {
      if ((query as Filter[]).some((f) => matches(doc, f))) return false;
    } else if (key === "$expr") {
      // Aggregation expression over the document's own fields, e.g. { $lte: ["$availableStock", 5] }.
      if (!evalExpr(query, doc)) return false;
    } else if (key === "$where" || key === "$text") {
      throw new Error(`Unsupported query operator ${key}`);
    } else if (!matchField(doc, key, query)) {
      return false;
    }
  }
  return true;
}

export function normalizeSort(sort?: SortSpec | string | null): [string, 1 | -1][] {
  if (!sort) return [];
  if (typeof sort === "string") {
    return sort
      .split(/\s+/)
      .filter(Boolean)
      .map((f) => (f.startsWith("-") ? [f.slice(1), -1] : [f, 1]) as [string, 1 | -1]);
  }
  return Object.entries(sort).map(([k, v]) => [k, v === -1 || v === "desc" || v === "descending" ? -1 : 1]);
}

function sortKey(doc: Doc, path: string, direction: 1 | -1) {
  const values = valuesAtPath(doc, path).flatMap((v) => (Array.isArray(v) ? v : [v]));
  if (values.length === 0) return undefined;
  // Ascending sorts use the smallest array element, descending the largest — as MongoDB does.
  return values.reduce((best, v) => (compareValues(v, best) * direction < 0 ? v : best));
}

export function sortDocs<T extends Doc>(docs: T[], sort?: SortSpec | string | null): T[] {
  const spec = normalizeSort(sort);
  if (spec.length === 0) return docs;
  return [...docs].sort((a, b) => {
    for (const [path, dir] of spec) {
      const c = compareValues(sortKey(a, path, dir), sortKey(b, path, dir));
      if (c !== 0) return c * dir;
    }
    return 0;
  });
}

export type Projection = string | Record<string, 0 | 1 | boolean> | null | undefined;

/** Parse a Mongoose select ('name email', '-password', '+password', { a: 1 }). */
export function parseProjection(select: Projection): { include: string[]; exclude: string[]; force: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];
  const force: string[] = [];
  if (!select) return { include, exclude, force };
  if (typeof select === "string") {
    for (const token of select.split(/\s+/).filter(Boolean)) {
      if (token.startsWith("+")) force.push(token.slice(1));
      else if (token.startsWith("-")) exclude.push(token.slice(1));
      else include.push(token);
    }
  } else {
    for (const [k, v] of Object.entries(select)) (v ? include : exclude).push(k);
  }
  return { include, exclude, force };
}

export function applyProjection(doc: Doc, select: Projection, hidden: string[] = []): Doc {
  const { include, exclude, force } = parseProjection(select);
  let out: Doc;
  if (include.length > 0) {
    out = {};
    if (!exclude.includes("_id")) out._id = doc._id;
    for (const path of [...include, ...force]) {
      const v = getPath(doc, path);
      if (v !== undefined) setPath(out, path, structuredClone(v));
    }
    return out;
  }
  out = structuredClone(doc);
  for (const path of hidden) if (!force.includes(path)) unsetPath(out, path);
  for (const path of exclude) unsetPath(out, path);
  return out;
}
