import { compareValues, type Doc, getPath, matches, normalizeValue, setPath, sortDocs } from "./query";

// The subset of MongoDB's aggregation pipeline the dashboard, reports,
// reviews and wishlist use, evaluated in JavaScript over pre-filtered rows.

export type Lookup = (from: string, localValues: any[], foreignField: string) => Promise<Doc[]>;

const toDate = (v: any) => (v instanceof Date ? v : new Date(v));

export function evalExpr(expr: any, doc: Doc, vars: Record<string, any> = {}): any {
  if (typeof expr === "string") {
    if (expr.startsWith("$$")) {
      const [name, ...rest] = expr.slice(2).split(".");
      const base = vars[name];
      return rest.length ? getPath(base, rest.join(".")) : base;
    }
    if (expr.startsWith("$")) {
      const path = expr.slice(1);
      // Field paths through arrays resolve to arrays of values (as MongoDB does).
      const parts = path.split(".");
      let cur: any = doc;
      for (const p of parts) {
        if (cur === null || cur === undefined) return undefined;
        cur = Array.isArray(cur) ? cur.map((x) => x?.[p]).filter((x) => x !== undefined) : cur[p];
      }
      return cur;
    }
    return expr;
  }
  if (Array.isArray(expr)) return expr.map((e) => evalExpr(e, doc, vars));
  if (expr === null || typeof expr !== "object" || expr instanceof Date) return normalizeValue(expr);

  const keys = Object.keys(expr);
  if (keys.length === 1 && keys[0].startsWith("$")) {
    const op = keys[0];
    const arg = expr[op];
    const args = () => (Array.isArray(arg) ? arg.map((a) => evalExpr(a, doc, vars)) : [evalExpr(arg, doc, vars)]);
    const num = (v: any) => (typeof v === "number" ? v : Number(v) || 0);
    switch (op) {
      case "$literal":
        return arg;
      case "$sum": {
        const vals = args();
        const flat = vals.length === 1 && Array.isArray(vals[0]) ? vals[0] : vals;
        return flat.reduce((s: number, v: any) => (typeof v === "number" ? s + v : s), 0);
      }
      case "$avg": {
        const vals = args();
        const flat = (vals.length === 1 && Array.isArray(vals[0]) ? vals[0] : vals).filter((v: any) => typeof v === "number");
        return flat.length ? flat.reduce((s: number, v: number) => s + v, 0) / flat.length : null;
      }
      case "$max": {
        const vals = args();
        const flat = vals.length === 1 && Array.isArray(vals[0]) ? vals[0] : vals;
        return flat.filter((v: any) => v !== null && v !== undefined).reduce((m: any, v: any) => (m === undefined || compareValues(v, m) > 0 ? v : m), undefined) ?? null;
      }
      case "$min": {
        const vals = args();
        const flat = vals.length === 1 && Array.isArray(vals[0]) ? vals[0] : vals;
        return flat.filter((v: any) => v !== null && v !== undefined).reduce((m: any, v: any) => (m === undefined || compareValues(v, m) < 0 ? v : m), undefined) ?? null;
      }
      case "$add": {
        const vals = args();
        return vals.reduce((s: number, v: any) => s + num(v), 0);
      }
      case "$subtract": {
        const [a, b] = args();
        return num(a) - num(b);
      }
      case "$multiply":
        return args().reduce((s: number, v: any) => s * num(v), 1);
      case "$divide": {
        const [a, b] = args();
        return num(b) === 0 ? null : num(a) / num(b);
      }
      case "$round": {
        const [v, places = 0] = args();
        if (v === null || v === undefined) return null;
        const f = 10 ** places;
        return Math.round(num(v) * f) / f;
      }
      case "$ifNull": {
        for (const v of args()) if (v !== null && v !== undefined) return v;
        return null;
      }
      case "$arrayElemAt": {
        const [arr, idx] = args();
        if (!Array.isArray(arr)) return undefined;
        return idx < 0 ? arr[arr.length + idx] : arr[idx];
      }
      case "$size": {
        const [arr] = args();
        return Array.isArray(arr) ? arr.length : 0;
      }
      case "$cond": {
        const [c, t, f] = Array.isArray(arg) ? arg : [arg.if, arg.then, arg.else];
        return evalExpr(c, doc, vars) ? evalExpr(t, doc, vars) : evalExpr(f, doc, vars);
      }
      case "$eq": {
        const [a, b] = args();
        return compareValues(a ?? null, b ?? null) === 0;
      }
      case "$ne": {
        const [a, b] = args();
        return compareValues(a ?? null, b ?? null) !== 0;
      }
      case "$gt": {
        const [a, b] = args();
        return compareValues(a, b) > 0;
      }
      case "$gte": {
        const [a, b] = args();
        return compareValues(a, b) >= 0;
      }
      case "$lt": {
        const [a, b] = args();
        return compareValues(a, b) < 0;
      }
      case "$lte": {
        const [a, b] = args();
        return compareValues(a, b) <= 0;
      }
      case "$and":
        return args().every(Boolean);
      case "$or":
        return args().some(Boolean);
      case "$not":
        return !args()[0];
      case "$in": {
        const [v, arr] = args();
        return Array.isArray(arr) && arr.some((x) => compareValues(x, v) === 0);
      }
      case "$concat":
        return args().map((v: any) => (v === null || v === undefined ? "" : String(v))).join("");
      case "$toString":
        return args()[0] === null || args()[0] === undefined ? null : String(args()[0]);
      case "$toLower":
        return String(args()[0] ?? "").toLowerCase();
      case "$toUpper":
        return String(args()[0] ?? "").toUpperCase();
      case "$year":
        return toDate(evalExpr(arg?.date ?? arg, doc, vars)).getUTCFullYear();
      case "$month":
        return toDate(evalExpr(arg?.date ?? arg, doc, vars)).getUTCMonth() + 1;
      case "$dayOfMonth":
        return toDate(evalExpr(arg?.date ?? arg, doc, vars)).getUTCDate();
      case "$hour":
        return toDate(evalExpr(arg?.date ?? arg, doc, vars)).getUTCHours();
      case "$dayOfWeek":
        return toDate(evalExpr(arg?.date ?? arg, doc, vars)).getUTCDay() + 1;
      case "$dateToString": {
        const d = evalExpr(arg.date, doc, vars);
        if (d === null || d === undefined) return null;
        const date = toDate(d);
        const pad = (n: number, w = 2) => String(n).padStart(w, "0");
        return String(arg.format || "%Y-%m-%dT%H:%M:%S.%LZ")
          .replace("%Y", String(date.getUTCFullYear()))
          .replace("%m", pad(date.getUTCMonth() + 1))
          .replace("%d", pad(date.getUTCDate()))
          .replace("%H", pad(date.getUTCHours()))
          .replace("%M", pad(date.getUTCMinutes()))
          .replace("%S", pad(date.getUTCSeconds()))
          .replace("%L", pad(date.getUTCMilliseconds(), 3));
      }
      case "$filter": {
        const input = evalExpr(arg.input, doc, vars);
        const as = arg.as || "this";
        return Array.isArray(input) ? input.filter((el) => evalExpr(arg.cond, doc, { ...vars, [as]: el })) : null;
      }
      case "$map": {
        const input = evalExpr(arg.input, doc, vars);
        const as = arg.as || "this";
        return Array.isArray(input) ? input.map((el) => evalExpr(arg.in, doc, { ...vars, [as]: el })) : null;
      }
      default:
        throw new Error(`Unsupported aggregation expression ${op}`);
    }
  }
  const out: Doc = {};
  for (const [k, v] of Object.entries(expr)) out[k] = evalExpr(v, doc, vars);
  return out;
}

function groupKey(v: any) {
  return JSON.stringify(v ?? null);
}

export async function runPipeline(input: Doc[], pipeline: Doc[], lookup: Lookup): Promise<Doc[]> {
  let docs = input;
  for (const stage of pipeline) {
    const [op] = Object.keys(stage);
    const arg = stage[op];
    switch (op) {
      case "$match":
        docs = docs.filter((d) => matches(d, arg));
        break;
      case "$sort":
        docs = sortDocs(docs, arg);
        break;
      case "$limit":
        docs = docs.slice(0, arg);
        break;
      case "$skip":
        docs = docs.slice(arg);
        break;
      case "$count":
        docs = docs.length ? [{ [arg]: docs.length }] : [];
        break;
      case "$unwind": {
        const spec = typeof arg === "string" ? { path: arg } : arg;
        const path = spec.path.replace(/^\$/, "");
        const out: Doc[] = [];
        for (const d of docs) {
          const v = getPath(d, path);
          if (Array.isArray(v) && v.length) {
            for (const el of v) {
              const copy = structuredClone(d);
              setPath(copy, path, el);
              out.push(copy);
            }
          } else if (spec.preserveNullAndEmptyArrays) out.push(d);
        }
        docs = out;
        break;
      }
      case "$lookup": {
        const out: Doc[] = [];
        const locals = docs.flatMap((d) => {
          const v = getPath(d, arg.localField);
          return Array.isArray(v) ? v : [v];
        });
        const foreign = await lookup(arg.from, locals.filter((v) => v !== undefined && v !== null), arg.foreignField);
        for (const d of docs) {
          const v = getPath(d, arg.localField);
          const localValues = Array.isArray(v) ? v : [v];
          const joined = foreign.filter((f) => {
            const fv = getPath(f, arg.foreignField);
            const fvs = Array.isArray(fv) ? fv : [fv];
            return fvs.some((x) => localValues.some((l) => compareValues(l, x) === 0));
          });
          out.push({ ...d, [arg.as]: joined });
        }
        docs = out;
        break;
      }
      case "$group": {
        const groups = new Map<string, { _id: any; members: Doc[] }>();
        for (const d of docs) {
          const id = evalExpr(arg._id, d);
          const key = groupKey(id);
          if (!groups.has(key)) groups.set(key, { _id: id ?? null, members: [] });
          groups.get(key)!.members.push(d);
        }
        docs = [...groups.values()].map(({ _id, members }) => {
          const out: Doc = { _id };
          for (const [field, acc] of Object.entries(arg)) {
            if (field === "_id") continue;
            const [accOp] = Object.keys(acc as Doc);
            const accArg = (acc as Doc)[accOp];
            const values = members.map((m) => evalExpr(accArg, m));
            switch (accOp) {
              case "$sum":
                out[field] = values.reduce((s, v) => (typeof v === "number" ? s + v : s), 0);
                break;
              case "$avg": {
                const nums = values.filter((v) => typeof v === "number");
                out[field] = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
                break;
              }
              case "$first":
                out[field] = values[0] ?? null;
                break;
              case "$last":
                out[field] = values[values.length - 1] ?? null;
                break;
              case "$max":
                out[field] = values.filter((v) => v !== null && v !== undefined).reduce((m, v) => (m === undefined || compareValues(v, m) > 0 ? v : m), undefined) ?? null;
                break;
              case "$min":
                out[field] = values.filter((v) => v !== null && v !== undefined).reduce((m, v) => (m === undefined || compareValues(v, m) < 0 ? v : m), undefined) ?? null;
                break;
              case "$push":
                out[field] = values;
                break;
              case "$addToSet": {
                const seen = new Map<string, any>();
                for (const v of values) seen.set(groupKey(v), v);
                out[field] = [...seen.values()];
                break;
              }
              case "$count":
                out[field] = members.length;
                break;
              default:
                throw new Error(`Unsupported accumulator ${accOp}`);
            }
          }
          return out;
        });
        break;
      }
      case "$project":
      case "$addFields":
      case "$set": {
        docs = docs.map((d) => {
          const includeOnly = op === "$project" && Object.values(arg).some((v) => v === 1 || v === true || (typeof v === "object" && v !== null) || (typeof v === "string" && v.startsWith("$")));
          const base: Doc = includeOnly ? (arg._id === 0 || arg._id === false ? {} : { _id: d._id }) : structuredClone(d);
          for (const [k, v] of Object.entries(arg)) {
            if (k === "_id" && (v === 0 || v === false)) {
              delete base._id;
              continue;
            }
            if (v === 0 || v === false) {
              delete base[k];
              continue;
            }
            if (v === 1 || v === true) {
              const val = getPath(d, k);
              if (val !== undefined) setPath(base, k, val);
              continue;
            }
            setPath(base, k, evalExpr(v, d));
          }
          return base;
        });
        break;
      }
      case "$replaceRoot":
        docs = docs.map((d) => evalExpr(arg.newRoot, d));
        break;
      case "$facet": {
        const out: Doc = {};
        for (const [name, sub] of Object.entries(arg)) out[name] = await runPipeline(docs, sub as Doc[], lookup);
        docs = [out];
        break;
      }
      default:
        throw new Error(`Unsupported aggregation stage ${op}`);
    }
  }
  return docs;
}
