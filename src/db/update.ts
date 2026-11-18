import { newObjectId } from "./objectid";
import { type Doc, type Filter, getPath, matches, normalizeValue, setPath, unsetPath } from "./query";

// MongoDB update operators applied to a stored document in JavaScript.
// Updates always run inside a write transaction (see store.ts), so the
// read-modify-write is atomic even with many requests at once.

export type Update = Record<string, any>;

function isOperatorUpdate(update: Update) {
  return Object.keys(update).some((k) => k.startsWith("$"));
}

/** Give new array sub-documents an `_id`, as Mongoose does for sub-schemas with `_id: true`. */
export type SubdocIdPaths = string[];

function withSubdocIds(path: string, value: any, subdocIdPaths: SubdocIdPaths) {
  const basePath = path.replace(/\.\d+(?=\.|$)/g, "").replace(/\.\$(?=\.|$)/g, "");
  if (!subdocIdPaths.includes(basePath)) return value;
  const add = (v: any) => (v && typeof v === "object" && !Array.isArray(v) && !v._id ? { _id: newObjectId(), ...v } : v);
  return Array.isArray(value) ? value.map(add) : add(value);
}

function resolvePositional(doc: Doc, path: string, filter: Filter): string {
  if (!path.includes(".$")) return path;
  // `items.$.quantity` → index of the first element matched by the filter on `items.*`.
  const [arrayPath] = path.split(".$");
  const arr = getPath(doc, arrayPath);
  if (!Array.isArray(arr)) return path.replace(".$", ".0");
  const elementFilter: Filter = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k.startsWith(arrayPath + ".")) elementFilter[k.slice(arrayPath.length + 1)] = v;
  }
  const idx = arr.findIndex((el) => matches(el, elementFilter));
  return path.replace(".$", `.${idx < 0 ? 0 : idx}`);
}

/**
 * Apply an update to a copy of `doc`. A plain object (no `$` keys) behaves like
 * Mongoose: its fields are `$set`, not a full replacement.
 */
export function applyUpdate(
  original: Doc,
  update: Update,
  options: { filter?: Filter; subdocIdPaths?: SubdocIdPaths; isInsert?: boolean } = {},
): Doc {
  const doc = structuredClone(original);
  const filter = options.filter ?? {};
  const subdocIdPaths = options.subdocIdPaths ?? [];
  const ops: Update = isOperatorUpdate(update) ? update : { $set: update };

  for (const [op, fields] of Object.entries(ops)) {
    if (!op.startsWith("$")) {
      // Mixed plain fields alongside operators: treat as $set.
      setPath(doc, op, withSubdocIds(op, normalizeValue(fields), subdocIdPaths));
      continue;
    }
    for (const [rawPath, rawValue] of Object.entries(fields ?? {})) {
      if (rawValue === undefined && op !== "$unset") continue;
      const path = resolvePositional(doc, rawPath, filter);
      const value = normalizeValue(rawValue);
      switch (op) {
        case "$set":
          setPath(doc, path, withSubdocIds(path, value, subdocIdPaths));
          break;
        case "$setOnInsert":
          if (options.isInsert) setPath(doc, path, withSubdocIds(path, value, subdocIdPaths));
          break;
        case "$unset":
          unsetPath(doc, path);
          break;
        case "$inc":
          setPath(doc, path, (Number(getPath(doc, path)) || 0) + Number(value));
          break;
        case "$mul":
          setPath(doc, path, (Number(getPath(doc, path)) || 0) * Number(value));
          break;
        case "$min": {
          const cur = getPath(doc, path);
          if (cur === undefined || value < cur) setPath(doc, path, value);
          break;
        }
        case "$max": {
          const cur = getPath(doc, path);
          if (cur === undefined || value > cur) setPath(doc, path, value);
          break;
        }
        case "$push": {
          const arr = Array.isArray(getPath(doc, path)) ? getPath(doc, path) : [];
          if (value && typeof value === "object" && Array.isArray(value.$each)) {
            const items = withSubdocIds(path, value.$each, subdocIdPaths);
            if (typeof value.$position === "number") arr.splice(value.$position, 0, ...items);
            else arr.push(...items);
            if (typeof value.$slice === "number") {
              const sliced = value.$slice < 0 ? arr.slice(value.$slice) : arr.slice(0, value.$slice);
              arr.length = 0;
              arr.push(...sliced);
            }
          } else {
            arr.push(withSubdocIds(path, value, subdocIdPaths));
          }
          setPath(doc, path, arr);
          break;
        }
        case "$addToSet": {
          const arr = Array.isArray(getPath(doc, path)) ? getPath(doc, path) : [];
          const items = value && typeof value === "object" && Array.isArray(value.$each) ? value.$each : [value];
          for (const item of items) {
            if (!arr.some((x: any) => JSON.stringify(x) === JSON.stringify(item))) arr.push(item);
          }
          setPath(doc, path, arr);
          break;
        }
        case "$pull": {
          const arr = getPath(doc, path);
          if (!Array.isArray(arr)) break;
          const keep = arr.filter((el: any) => {
            if (value && typeof value === "object" && !Array.isArray(value)) {
              return el && typeof el === "object" ? !matches(el, value) : !matches({ v: el }, { v: value });
            }
            return JSON.stringify(el) !== JSON.stringify(value);
          });
          setPath(doc, path, keep);
          break;
        }
        case "$pullAll": {
          const arr = getPath(doc, path);
          if (!Array.isArray(arr)) break;
          const remove = (value as any[]).map((v) => JSON.stringify(v));
          setPath(doc, path, arr.filter((el: any) => !remove.includes(JSON.stringify(el))));
          break;
        }
        case "$pop": {
          const arr = getPath(doc, path);
          if (Array.isArray(arr)) value === -1 ? arr.shift() : arr.pop();
          break;
        }
        case "$currentDate":
          setPath(doc, path, new Date().toISOString());
          break;
        default:
          throw new Error(`Unsupported update operator ${op}`);
      }
    }
  }
  return doc;
}

/** Fields an upsert copies from equality conditions in the filter. */
export function seedFromFilter(filter: Filter): Doc {
  const seed: Doc = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k.startsWith("$")) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && Object.keys(v).some((x) => x.startsWith("$"))) {
      if ("$eq" in v) setPath(seed, k, normalizeValue(v.$eq));
      continue;
    }
    setPath(seed, k, normalizeValue(v));
  }
  return seed;
}
