import "server-only";
import { type Doc, getPath, type Projection, setPath, applyProjection } from "./query";
import type { CollectionName } from "./schema";
import { collection } from "./store";

// Mongoose-style populate: replace ObjectId references with the referenced
// documents. Works on a single id or an array of ids, at any depth
// (`items`, `items.productId`, `scope.categoryIds`).

export type PopulateSpec = {
  path: string;
  from: CollectionName;
  select?: Projection;
  /** Nested populate on the fetched documents. */
  populate?: PopulateSpec | PopulateSpec[];
  /** Extra filter for the referenced documents (Mongoose `match`). */
  match?: Record<string, unknown>;
};

function collectRefs(node: any, parts: string[], out: Set<string>) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const el of node) collectRefs(el, parts, out);
    return;
  }
  if (parts.length === 0) {
    if (typeof node === "string") out.add(node);
    return;
  }
  if (typeof node === "object") collectRefs(node[parts[0]], parts.slice(1), out);
}

function replaceRefs(node: any, parts: string[], byId: Map<string, Doc>, parent: any, key: string | number | null) {
  if (node === null || node === undefined) return;
  if (parts.length === 0) {
    if (Array.isArray(node)) {
      // Array of ids: keep found documents only (Mongoose drops missing ones).
      const replaced = node.map((id) => (typeof id === "string" ? byId.get(id) : id)).filter((x) => x !== undefined);
      if (parent !== null && key !== null) parent[key] = replaced;
    } else if (typeof node === "string" && parent !== null && key !== null) {
      parent[key] = byId.get(node) ?? null;
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((el, i) => replaceRefs(el, parts, byId, node, i));
    return;
  }
  if (typeof node === "object") replaceRefs(node[parts[0]], parts.slice(1), byId, node, parts[0]);
}

export async function populate<T extends Doc | Doc[] | null>(target: T, specs: PopulateSpec | PopulateSpec[]): Promise<T> {
  if (!target) return target;
  const docs = Array.isArray(target) ? target : [target];
  for (const spec of Array.isArray(specs) ? specs : [specs]) {
    const parts = spec.path.split(".");
    const ids = new Set<string>();
    for (const d of docs) collectRefs(d, parts, ids);
    if (ids.size === 0) continue;
    const found = await collection(spec.from).find({ _id: { $in: [...ids] }, ...(spec.match ?? {}) });
    let projected = found.map((d) => (spec.select ? applyProjection(d, spec.select) : d));
    if (spec.populate) projected = await populate(projected, spec.populate);
    const byId = new Map(projected.map((d) => [String(d._id), d]));
    for (const d of docs) replaceRefs(d[parts[0]], parts.slice(1), byId, d, parts[0]);
  }
  return target;
}

export { getPath, setPath };
