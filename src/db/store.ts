import "server-only";
import type { InValue } from "@libsql/client";
import { executor, withTransaction } from "./client";
import { MODELS, type ModelConfig } from "./models";
import { newObjectId } from "./objectid";
import {
  applyProjection,
  type Doc,
  type Filter,
  getPath,
  matches,
  normalizeSort,
  normalizeValue,
  type Projection,
  type SortSpec,
  sortDocs,
} from "./query";
import type { CollectionName } from "./schema";
import { applyUpdate, seedFromFilter, type Update } from "./update";

// A small MongoDB-style document store over Turso/SQLite.
//
// Filters on known scalar paths are compiled to SQL (using json_extract and
// expression indexes); anything else is evaluated in JavaScript with exact
// MongoDB semantics. All writes run in write transactions, so concurrent
// requests can't interleave a read-modify-write.

export type FindOptions = {
  sort?: SortSpec | string | null;
  skip?: number;
  limit?: number;
  select?: Projection;
};

export class DuplicateKeyError extends Error {
  code = 11000;
  keyValue: Record<string, unknown>;
  constructor(keyValue: Record<string, unknown>) {
    super(`Duplicate key: ${JSON.stringify(keyValue)}`);
    this.name = "MongoServerError";
    this.keyValue = keyValue;
  }
}

function sqlPathExpr(path: string) {
  return path === "_id" ? "id" : `json_extract(doc, '$.${path}')`;
}

function sqlScalar(v: any): InValue {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === undefined) return null;
  return v as InValue;
}

type Compiled = { where: string; args: InValue[]; exact: boolean };

/** Compile the SQL-safe part of a filter. `exact` = every clause was compiled. */
function compileFilter(filter: Filter, model: ModelConfig): Compiled {
  const clauses: string[] = [];
  const args: InValue[] = [];
  let exact = true;

  const isScalar = (v: any) => v === null || ["string", "number", "boolean"].includes(typeof v);

  for (const [key, rawQuery] of Object.entries(filter)) {
    if (rawQuery === undefined) continue;
    if (key === "$and" && Array.isArray(rawQuery)) {
      for (const sub of rawQuery) {
        const c = compileFilter(sub, model);
        if (c.where !== "1") clauses.push(`(${c.where})`);
        args.push(...c.args);
        exact &&= c.exact;
      }
      continue;
    }
    if (key === "$or" && Array.isArray(rawQuery)) {
      const parts = rawQuery.map((sub) => compileFilter(sub, model));
      if (parts.every((p) => p.exact)) {
        clauses.push(`(${parts.map((p) => `(${p.where})`).join(" OR ")})`);
        for (const p of parts) args.push(...p.args);
      } else exact = false;
      continue;
    }
    const pathAllowed = key === "_id" || model.sqlPaths.includes(key);
    if (!pathAllowed || key.startsWith("$")) {
      exact = false;
      continue;
    }
    const col = sqlPathExpr(key);
    const eachExists = (op: string) =>
      key === "_id" ? `id ${op} ?` : `EXISTS (SELECT 1 FROM json_each(doc, '$.${key}') WHERE value ${op} ?)`;
    const query = rawQuery instanceof RegExp ? rawQuery : normalizeValue(rawQuery);

    if (isScalar(query)) {
      if (query === null) clauses.push(`${col} IS NULL`);
      else {
        clauses.push(eachExists("="));
        args.push(sqlScalar(query));
      }
      continue;
    }
    if (query && typeof query === "object" && !Array.isArray(query) && !(query instanceof RegExp)) {
      let handledAll = true;
      for (const [op, operand] of Object.entries(query)) {
        if (op === "$in" && Array.isArray(operand) && operand.every((x) => isScalar(x) && x !== null)) {
          if (operand.length === 0) clauses.push("0");
          else {
            clauses.push(
              key === "_id"
                ? `id IN (${operand.map(() => "?").join(",")})`
                : `EXISTS (SELECT 1 FROM json_each(doc, '$.${key}') WHERE value IN (${operand.map(() => "?").join(",")}))`,
            );
            args.push(...operand.map(sqlScalar));
          }
        } else if (op === "$eq" && isScalar(operand) && operand !== null) {
          clauses.push(eachExists("="));
          args.push(sqlScalar(operand));
        } else if (["$gt", "$gte", "$lt", "$lte"].includes(op) && (typeof operand === "number" || typeof operand === "string")) {
          // MongoDB only compares values of the same type (numbers with numbers, strings with strings).
          const sqlOp = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[op as "$gt"];
          const types = typeof operand === "number" ? "('integer','real')" : "('text')";
          clauses.push(`(${col} ${sqlOp} ? AND typeof(${col}) IN ${types})`);
          args.push(operand);
        } else {
          handledAll = false;
        }
      }
      if (!handledAll) exact = false;
      continue;
    }
    exact = false;
  }
  return { where: clauses.length ? clauses.join(" AND ") : "1", args, exact };
}

function canSortInSql(sort: FindOptions["sort"], model: ModelConfig) {
  return normalizeSort(sort).every(([p]) => p === "_id" || model.sqlPaths.includes(p));
}

function orderBy(sort: FindOptions["sort"]) {
  const spec = normalizeSort(sort);
  if (spec.length === 0) return "";
  return " ORDER BY " + spec.map(([p, d]) => `${sqlPathExpr(p)} ${d === -1 ? "DESC" : "ASC"}`).join(", ");
}

function parseRow(row: any): Doc {
  return JSON.parse(row.doc as string);
}

function deepDefaults(target: Doc, defaults: Doc): Doc {
  for (const [k, v] of Object.entries(defaults)) {
    if (target[k] === undefined) target[k] = structuredClone(v);
    else if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) {
      deepDefaults(target[k], v);
    }
  }
  return target;
}

const SYSTEM_KEYS = new Set(["_id", "__v", "createdAt", "updatedAt"]);

/**
 * Mongoose behaviour on write: sub-document defaults, `_id`s and per-item
 * timestamps; unknown top-level keys dropped (strict mode) unless they were
 * already stored; then the model's normalisation (trim/lowercase/…).
 */
function finalize(model: ModelConfig, next: Doc, current: Doc | null): Doc {
  const now = new Date().toISOString();
  for (const [path, spec] of Object.entries(model.subdocs ?? {})) {
    const value = getPath(next, path);
    const before = current ? getPath(current, path) : undefined;
    const fill = (el: any) => {
      if (!el || typeof el !== "object" || Array.isArray(el)) return el;
      deepDefaults(el, spec.defaults());
      return el;
    };
    if (Array.isArray(value)) {
      const beforeById = new Map((Array.isArray(before) ? before : []).filter((x: any) => x?._id).map((x: any) => [String(x._id), x]));
      value.forEach((el, i) => {
        value[i] = fill(el);
        if (!spec.timestamps || !el || typeof el !== "object") return;
        const prev = el._id ? beforeById.get(String(el._id)) : undefined;
        if (!prev) {
          el.createdAt ??= now;
          el.updatedAt ??= now;
        } else {
          const { updatedAt: _a, ...a } = prev;
          const { updatedAt: _b, ...b } = el;
          el.createdAt ??= prev.createdAt;
          el.updatedAt = JSON.stringify(a) === JSON.stringify(b) ? prev.updatedAt : now;
        }
      });
    } else if (value && typeof value === "object") {
      fill(value);
    }
  }
  for (const path of model.subdocIds ?? []) {
    const arr = getPath(next, path);
    if (Array.isArray(arr)) for (const el of arr) if (el && typeof el === "object" && !el._id) el._id = newObjectId();
  }
  if (model.fields) {
    const allowed = new Set(model.fields);
    for (const key of Object.keys(next)) {
      if (SYSTEM_KEYS.has(key) || allowed.has(key)) continue;
      if (current && key in current) next[key] = current[key];
      else delete next[key];
    }
  }
  model.normalize?.(next);
  return next;
}

export class Collection<T extends Doc = Doc> {
  readonly model: ModelConfig;
  constructor(readonly name: CollectionName) {
    this.model = MODELS[name];
  }

  private async rows(filter: Filter, opts: FindOptions = {}): Promise<Doc[]> {
    const ex = await executor();
    const compiled = compileFilter(filter, this.model);
    const sqlPaging = compiled.exact && canSortInSql(opts.sort, this.model);
    let sql = `SELECT doc FROM "${this.name}" WHERE ${compiled.where}`;
    const args = [...compiled.args];
    if (sqlPaging) {
      sql += orderBy(opts.sort);
      if (opts.limit && opts.limit > 0) {
        sql += " LIMIT ?";
        args.push(opts.limit);
        if (opts.skip) {
          sql += " OFFSET ?";
          args.push(opts.skip);
        }
      } else if (opts.skip) {
        sql += " LIMIT -1 OFFSET ?";
        args.push(opts.skip);
      }
    }
    const result = await ex.execute({ sql, args });
    let docs = result.rows.map(parseRow);
    if (!compiled.exact) docs = docs.filter((d) => matches(d, filter));
    if (!sqlPaging) {
      docs = sortDocs(docs, opts.sort);
      const start = opts.skip ?? 0;
      docs = docs.slice(start, opts.limit && opts.limit > 0 ? start + opts.limit : undefined);
    }
    return docs;
  }

  private project(doc: Doc, select?: Projection): T {
    return applyProjection(doc, select, this.model.hidden) as T;
  }

  async find(filter: Filter = {}, opts: FindOptions = {}): Promise<T[]> {
    const docs = await this.rows(filter, opts);
    return docs.map((d) => this.project(d, opts.select));
  }

  async findOne(filter: Filter = {}, opts: Omit<FindOptions, "limit" | "skip"> = {}): Promise<T | null> {
    const [doc] = await this.rows(filter, { ...opts, limit: 1 });
    return doc ? this.project(doc, opts.select) : null;
  }

  async findById(id: unknown, opts: { select?: Projection } = {}): Promise<T | null> {
    if (typeof id !== "string" || !/^[0-9a-fA-F]{24}$/.test(id)) {
      if (id === null || id === undefined) return null;
      const s = String(id);
      if (!/^[0-9a-fA-F]{24}$/.test(s)) throw castError(s);
      return this.findOne({ _id: s }, opts);
    }
    return this.findOne({ _id: id }, opts);
  }

  async count(filter: Filter = {}): Promise<number> {
    const compiled = compileFilter(filter, this.model);
    const ex = await executor();
    if (compiled.exact) {
      const r = await ex.execute({ sql: `SELECT COUNT(*) AS n FROM "${this.name}" WHERE ${compiled.where}`, args: compiled.args });
      return Number(r.rows[0].n);
    }
    return (await this.rows(filter)).length;
  }

  async exists(filter: Filter): Promise<boolean> {
    return (await this.findOne(filter, { select: "_id" })) !== null;
  }

  async distinct(path: string, filter: Filter = {}): Promise<any[]> {
    const docs = await this.rows(filter);
    const seen = new Map<string, any>();
    for (const d of docs) {
      const v = getPath(d, path);
      for (const x of Array.isArray(v) ? v : [v]) if (x !== undefined) seen.set(JSON.stringify(x), x);
    }
    return [...seen.values()];
  }

  /** Build a full document as Mongoose would on create (defaults, ids, timestamps). */
  prepare(input: Doc): Doc {
    const now = new Date().toISOString();
    const doc: Doc = normalizeValue({ ...input });
    if (!doc._id) doc._id = newObjectId();
    if (this.model.defaults) deepDefaults(doc, this.model.defaults());
    if (this.model.timestamps) {
      doc.createdAt ??= now;
      doc.updatedAt ??= now;
    }
    if (doc.__v === undefined) doc.__v = 0;
    return finalize(this.model, doc, null);
  }

  private async checkUnique(doc: Doc) {
    for (const u of this.model.unique ?? []) {
      const values = u.paths.map((p) => getPath(doc, p));
      if (u.sparse && values.some((v) => v === undefined || v === null)) continue;
      const filter: Filter = { _id: { $ne: doc._id } };
      u.paths.forEach((p, i) => {
        filter[p] = u.caseInsensitive && typeof values[i] === "string"
          ? new RegExp(`^${values[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
          : values[i];
      });
      const clash = await this.rows(filter, { limit: 1 });
      if (clash.length) throw new DuplicateKeyError(Object.fromEntries(u.paths.map((p, i) => [p, values[i]])));
    }
  }

  private async writeNew(doc: Doc) {
    await this.checkUnique(doc);
    const ex = await executor();
    await ex.execute({ sql: `INSERT INTO "${this.name}" (id, doc) VALUES (?, ?)`, args: [doc._id, JSON.stringify(doc)] });
  }

  private async writeExisting(doc: Doc) {
    await this.checkUnique(doc);
    const ex = await executor();
    await ex.execute({ sql: `UPDATE "${this.name}" SET doc = ? WHERE id = ?`, args: [JSON.stringify(doc), doc._id] });
  }

  async create(input: Doc): Promise<T> {
    const doc = this.prepare(input);
    await withTransaction(() => this.writeNew(doc));
    return this.project(doc);
  }

  async insertMany(inputs: Doc[]): Promise<T[]> {
    const docs = inputs.map((d) => this.prepare(d));
    await withTransaction(async () => {
      for (const d of docs) await this.writeNew(d);
    });
    return docs.map((d) => this.project(d));
  }

  /**
   * findOneAndUpdate. Returns the updated document by default (`new: true`),
   * or the original with `{ new: false }`.
   */
  async findOneAndUpdate(
    filter: Filter,
    update: Update,
    opts: { new?: boolean; upsert?: boolean; select?: Projection; sort?: FindOptions["sort"]; timestamps?: boolean } = {},
  ): Promise<T | null> {
    return withTransaction(async () => {
      const [current] = await this.rows(filter, { sort: opts.sort, limit: 1 });
      if (!current) {
        if (!opts.upsert) return null;
        const seeded = applyUpdate(seedFromFilter(filter), update, { filter, subdocIdPaths: this.model.subdocIds, isInsert: true });
        const doc = this.prepare(seeded);
        await this.writeNew(doc);
        return opts.new === false ? null : this.project(doc, opts.select);
      }
      const next = this.applyTo(current, update, filter, opts.timestamps);
      await this.writeExisting(next);
      return this.project(opts.new === false ? current : next, opts.select);
    });
  }

  async findByIdAndUpdate(id: string, update: Update, opts: Parameters<Collection["findOneAndUpdate"]>[2] = {}) {
    return this.findOneAndUpdate({ _id: String(id) }, update, opts);
  }

  async updateOne(filter: Filter, update: Update, opts: { upsert?: boolean } = {}) {
    const result = await this.findOneAndUpdate(filter, update, { ...opts, new: false });
    return { matchedCount: result ? 1 : 0, modifiedCount: result ? 1 : 0 };
  }

  async updateMany(filter: Filter, update: Update): Promise<{ matchedCount: number; modifiedCount: number }> {
    return withTransaction(async () => {
      const docs = await this.rows(filter);
      for (const d of docs) await this.writeExisting(this.applyTo(d, update, filter));
      return { matchedCount: docs.length, modifiedCount: docs.length };
    });
  }

  /** Replace a whole document (Mongoose `doc.save()` on a loaded document). */
  async save(doc: Doc): Promise<T> {
    return withTransaction(async () => {
      const exists = await this.rows({ _id: doc._id }, { limit: 1 });
      if (!exists.length) {
        const prepared = this.prepare(doc);
        await this.writeNew(prepared);
        return this.project(prepared);
      }
      const next: Doc = normalizeValue({ ...doc });
      // Keep hidden fields that the caller didn't load.
      for (const h of this.model.hidden ?? []) if (next[h] === undefined && exists[0][h] !== undefined) next[h] = exists[0][h];
      if (this.model.timestamps) next.updatedAt = new Date().toISOString();
      finalize(this.model, next, exists[0]);
      await this.writeExisting(next);
      return this.project(next);
    });
  }

  async deleteOne(filter: Filter) {
    return withTransaction(async () => {
      const [doc] = await this.rows(filter, { limit: 1 });
      if (!doc) return { deletedCount: 0 };
      const ex = await executor();
      await ex.execute({ sql: `DELETE FROM "${this.name}" WHERE id = ?`, args: [doc._id] });
      return { deletedCount: 1 };
    });
  }

  async deleteMany(filter: Filter) {
    return withTransaction(async () => {
      const docs = await this.rows(filter);
      const ex = await executor();
      for (const d of docs) await ex.execute({ sql: `DELETE FROM "${this.name}" WHERE id = ?`, args: [d._id] });
      return { deletedCount: docs.length };
    });
  }

  async findByIdAndDelete(id: string) {
    const doc = await this.findById(id);
    if (doc) await this.deleteOne({ _id: doc._id });
    return doc;
  }

  private applyTo(current: Doc, update: Update, filter: Filter, timestamps = true): Doc {
    const next = applyUpdate(current, update, { filter, subdocIdPaths: this.model.subdocIds });
    if (this.model.timestamps && timestamps !== false) {
      const explicit = (update.$set && update.$set.updatedAt) || update.updatedAt;
      next.updatedAt = explicit ? normalizeValue(explicit) : new Date().toISOString();
    }
    return finalize(this.model, next, current);
  }
}

function castError(value: string) {
  return Object.assign(new Error(`Cast to ObjectId failed for value "${value}"`), { name: "CastError" });
}

const cache = new Map<string, Collection>();

/** Access a collection: `collection("products").find({ status: "published" })`. */
export function collection<T extends Doc = Doc>(name: CollectionName): Collection<T> {
  if (!cache.has(name)) cache.set(name, new Collection(name));
  return cache.get(name) as Collection<T>;
}

export type { Doc, Filter };
