import "server-only";
import { runPipeline } from "./aggregate";
import { withTransaction } from "./client";
import { type PopulateSpec, populate as populateDocs } from "./populate";
import { applyProjection, type Doc, type Filter, getPath, type Projection, setPath, type SortSpec } from "./query";
import type { CollectionName } from "./schema";
import { collection, type Collection } from "./store";

// A Mongoose-compatible facade over the Turso document store, so the original
// services port across with their logic untouched:
//   Product.find({ status: 'published' }).sort({ createdAt: -1 }).limit(10).populate('categoryId').lean()
// Documents are plain objects (exactly what MongoDB returned) with a few
// non-enumerable helpers (save, toObject, populate…), so `res.json(doc)` is unchanged.

type RefMap = Record<string, string>; // path → model name

const MODEL_COLLECTIONS: Record<string, CollectionName> = {};
const MODEL_REFS: Record<string, RefMap> = {};

export type PopulateArg =
  | string
  | { path: string; select?: Projection; model?: string; populate?: PopulateArg | PopulateArg[]; match?: Filter; options?: any }
  | PopulateArg[];

function toSpecs(modelName: string, arg: PopulateArg, selectArg?: Projection): PopulateSpec[] {
  if (Array.isArray(arg)) return arg.flatMap((a) => toSpecs(modelName, a));
  if (typeof arg === "string") {
    return arg
      .split(/\s+/)
      .filter(Boolean)
      .map((path) => specFor(modelName, path, selectArg));
  }
  const spec = specFor(modelName, arg.path, arg.select, arg.model);
  if (arg.match) spec.match = arg.match;
  if (arg.populate) {
    const childModel = arg.model || MODEL_REFS[modelName]?.[arg.path.replace(/\.\d+/g, "")];
    spec.populate = toSpecs(childModel, arg.populate);
  }
  return [spec];
}

function specFor(modelName: string, path: string, select?: Projection, explicitModel?: string): PopulateSpec {
  const refModel = explicitModel || MODEL_REFS[modelName]?.[path];
  if (!refModel) throw new Error(`No ref for populate path "${path}" on ${modelName}`);
  return { path, from: MODEL_COLLECTIONS[refModel], select };
}

export type HydratedDoc = Doc & {
  save(): Promise<HydratedDoc>;
  toObject(): Doc;
  toJSON(): Doc;
  populate(arg: PopulateArg): Promise<HydratedDoc>;
  set(path: string | Doc, value?: unknown): HydratedDoc;
  get(path: string): any;
  deleteOne(): Promise<{ deletedCount: number }>;
  isModified(path?: string): boolean;
  markModified(path: string): void;
  isNew: boolean;
  id: string;
};

/** Deep copy of the enumerable data (what res.json() would send), without helper methods. */
function plain(value: any): any {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toHexString === "function") return value.toHexString();
  if (Array.isArray(value)) return value.map(plain);
  const out: Doc = {};
  for (const key of Object.keys(value)) {
    const v = value[key];
    if (v !== undefined && typeof v !== "function") out[key] = plain(v);
  }
  return out;
}

/** Walk every value at a dotted ref path, letting `fn` replace it. */
function mapAtPath(node: any, parts: string[], fn: (value: any, parent: any, key: string | number) => void, parent: any = null, key: string | number | null = null) {
  if (node === null || node === undefined) return;
  if (parts.length === 0) {
    if (Array.isArray(node)) node.forEach((v, i) => fn(v, node, i));
    else if (parent !== null && key !== null) fn(node, parent, key);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((el, i) => mapAtPath(el, parts, fn, node, i));
    return;
  }
  if (typeof node === "object") mapAtPath(node[parts[0]], parts.slice(1), fn, node, parts[0]);
}

const isPopulated = (v: any) => v && typeof v === "object" && !Array.isArray(v) && v._id !== undefined;

/** Mongoose saves populated paths as their ids. */
function depopulate(doc: Doc, refs: RefMap): Doc {
  const copy = plain(doc);
  for (const path of Object.keys(refs)) {
    const parts = path.split(".");
    mapAtPath(copy[parts[0]], parts.slice(1), (v, parent, key) => {
      if (isPopulated(v)) parent[key] = String(v._id);
    }, copy, parts[0]);
  }
  return copy;
}

/** After saving, keep populated objects in memory where the stored doc has ids. */
function restorePopulated(stored: Doc, memory: Doc, refs: RefMap) {
  for (const path of Object.keys(refs)) {
    const parts = path.split(".");
    const populated: any[] = [];
    mapAtPath(memory[parts[0]], parts.slice(1), (v) => populated.push(v), memory, parts[0]);
    let i = 0;
    mapAtPath(stored[parts[0]], parts.slice(1), (_v, parent, key) => {
      const mem = populated[i++];
      if (isPopulated(mem)) parent[key] = mem;
    }, stored, parts[0]);
  }
  return stored;
}

export class Model<T extends Doc = Doc> {
  readonly store: Collection;
  constructor(
    readonly modelName: string,
    readonly collectionName: CollectionName,
    refs: RefMap = {},
  ) {
    MODEL_COLLECTIONS[modelName] = collectionName;
    MODEL_REFS[modelName] = refs;
    this.store = collection(collectionName);
  }

  hydrate(raw: Doc, isNew = false): HydratedDoc & T {
    const doc = raw as HydratedDoc & T;
    const model = this;
    const define = (name: string, value: unknown) =>
      Object.defineProperty(doc, name, { value, enumerable: false, configurable: true, writable: true });
    define("isNew", isNew);
    define("id", String(raw._id));
    define("save", async function save() {
      const refs = MODEL_REFS[model.modelName] ?? {};
      const data = depopulate(doc, refs);
      const stored = doc.isNew ? await model.store.create(data) : await model.store.save(data);
      restorePopulated(stored, doc, refs);
      for (const k of Object.keys(doc)) if (!(k in stored)) delete (doc as Doc)[k];
      Object.assign(doc, stored);
      define("isNew", false);
      return doc;
    });
    define("toObject", () => plain(doc));
    define("toJSON", () => plain(doc));
    define("populate", async (arg: PopulateArg) => {
      await populateDocs(doc, toSpecs(model.modelName, arg));
      return doc;
    });
    define("set", (path: string | Doc, value?: unknown) => {
      if (typeof path === "object") for (const [k, v] of Object.entries(path)) setPath(doc, k, v);
      else setPath(doc, path, value);
      return doc;
    });
    define("get", (path: string) => getPath(doc, path));
    define("deleteOne", () => model.store.deleteOne({ _id: doc._id }));
    define("isModified", () => true);
    define("markModified", () => undefined);
    return doc;
  }

  /** `new Model(data)` equivalent — an unsaved document with defaults applied. */
  build(data: Doc): HydratedDoc & T {
    return this.hydrate(this.store.prepare(data), true);
  }

  find(filter: Filter = {}, projection?: Projection, options: { sort?: SortSpec; limit?: number; skip?: number } = {}) {
    return new Query<(HydratedDoc & T)[]>(this, "find", filter, { select: projection, ...options });
  }

  findOne(filter: Filter = {}, projection?: Projection) {
    return new Query<(HydratedDoc & T) | null>(this, "findOne", filter, { select: projection });
  }

  findById(id: unknown, projection?: Projection) {
    return new Query<(HydratedDoc & T) | null>(this, "findById", { _id: id === null || id === undefined ? null : String(id) }, { select: projection });
  }

  findOneAndUpdate(filter: Filter, update: Doc, options: Doc = {}) {
    return new Query<(HydratedDoc & T) | null>(this, "findOneAndUpdate", filter, {
      update,
      new: options.new === true || options.returnDocument === "after",
      upsert: Boolean(options.upsert),
      select: options.projection ?? options.select ?? options.fields,
      sort: options.sort,
      timestamps: options.timestamps,
    });
  }

  findByIdAndUpdate(id: unknown, update: Doc, options: Doc = {}) {
    return this.findOneAndUpdate({ _id: String(id) }, update, options);
  }

  findOneAndDelete(filter: Filter) {
    return new Query<(HydratedDoc & T) | null>(this, "findOneAndDelete", filter, {});
  }

  findByIdAndDelete(id: unknown) {
    return this.findOneAndDelete({ _id: String(id) });
  }

  async create(data: Doc | Doc[], _options?: unknown): Promise<any> {
    if (Array.isArray(data)) {
      const created = await this.store.insertMany(data);
      return created.map((d) => this.hydrate(d));
    }
    return this.hydrate(await this.store.create(data));
  }

  async insertMany(data: Doc[], _options?: unknown) {
    return (await this.store.insertMany(data)).map((d) => this.hydrate(d));
  }

  async countDocuments(filter: Filter = {}) {
    return this.store.count(filter);
  }

  async estimatedDocumentCount() {
    return this.store.count({});
  }

  async exists(filter: Filter) {
    const doc = await this.store.findOne(filter, { select: "_id" });
    return doc ? { _id: doc._id } : null;
  }

  async distinct(path: string, filter: Filter = {}) {
    return this.store.distinct(path, filter);
  }

  async updateOne(filter: Filter, update: Doc, options: Doc = {}) {
    const before = await this.store.findOne(filter, { select: "_id" });
    const r = await this.store.updateOne(filter, update, { upsert: options.upsert });
    return { acknowledged: true, matchedCount: before ? 1 : 0, modifiedCount: r.modifiedCount, upsertedCount: before ? 0 : r.matchedCount };
  }

  async updateMany(filter: Filter, update: Doc) {
    const r = await this.store.updateMany(filter, update);
    return { acknowledged: true, ...r };
  }

  async deleteOne(filter: Filter) {
    return { acknowledged: true, ...(await this.store.deleteOne(filter)) };
  }

  async deleteMany(filter: Filter = {}) {
    return { acknowledged: true, ...(await this.store.deleteMany(filter)) };
  }

  aggregate(pipeline: Doc[]) {
    const run = async () => {
      // Push a leading $match down to the store (SQL prefilter), then run the rest in JS.
      const [first, ...rest] = pipeline;
      const hasMatch = first && "$match" in first;
      const docs = await this.store.find(hasMatch ? first.$match : {});
      return runPipeline(docs, hasMatch ? rest : pipeline, async (from, values, foreignField) =>
        collection(from as CollectionName).find({ [foreignField]: { $in: values.map(String) } }),
      );
    };
    const promise = { exec: run, then: (a: any, b: any) => run().then(a, b), catch: (b: any) => run().catch(b), option: () => promise, allowDiskUse: () => promise };
    return promise;
  }

  /** Mongoose `Model.startSession()` replacement: run work in one transaction. */
  async withTransaction<R>(fn: () => Promise<R>): Promise<R> {
    return withTransaction(() => fn());
  }
}

type QueryKind = "find" | "findOne" | "findById" | "findOneAndUpdate" | "findOneAndDelete";

export class Query<R> implements PromiseLike<R> {
  private opts: Doc;
  private populates: PopulateArg[] = [];
  private isLean = false;

  constructor(
    private model: Model<any>,
    private kind: QueryKind,
    private filter: Filter,
    opts: Doc,
  ) {
    this.opts = { ...opts };
  }

  sort(sort: SortSpec | string) {
    this.opts.sort = sort;
    return this;
  }
  skip(n: number) {
    this.opts.skip = n;
    return this;
  }
  limit(n: number) {
    this.opts.limit = n;
    return this;
  }
  select(select: Projection) {
    if (typeof select === "string" && typeof this.opts.select === "string") this.opts.select = `${this.opts.select} ${select}`;
    else this.opts.select = select;
    return this;
  }
  populate(arg: PopulateArg, select?: Projection) {
    this.populates.push(select && typeof arg === "string" ? { path: arg, select } : arg);
    return this;
  }
  lean(_lean = true) {
    this.isLean = true;
    return this;
  }
  session(_s: unknown) {
    return this;
  }
  collation(_c: unknown) {
    return this;
  }
  hint(_h: unknown) {
    return this;
  }
  setOptions(_o: unknown) {
    return this;
  }
  where(filter: Filter) {
    Object.assign(this.filter, filter);
    return this;
  }
  async countDocuments() {
    return this.model.countDocuments(this.filter);
  }

  async exec(): Promise<R> {
    const store = this.model.store;
    let result: Doc | Doc[] | null;
    switch (this.kind) {
      case "find":
        result = await store.find(this.filter, { sort: this.opts.sort, skip: this.opts.skip, limit: this.opts.limit, select: this.opts.select });
        break;
      case "findOne":
        result = await store.findOne(this.filter, { sort: this.opts.sort, select: this.opts.select });
        break;
      case "findById":
        result = this.filter._id === null ? null : await store.findById(this.filter._id, { select: this.opts.select });
        break;
      case "findOneAndUpdate":
        result = await store.findOneAndUpdate(this.filter, this.opts.update, {
          new: this.opts.new,
          upsert: this.opts.upsert,
          select: this.opts.select,
          sort: this.opts.sort,
          timestamps: this.opts.timestamps,
        });
        break;
      case "findOneAndDelete": {
        const doc = await store.findOne(this.filter);
        if (doc) await store.deleteOne({ _id: doc._id });
        result = doc;
        break;
      }
    }
    if (result && this.populates.length) {
      await populateDocs(result as any, this.populates.flatMap((p) => toSpecs(this.model.modelName, p)));
    }
    if (this.isLean || !result) return result as R;
    return (Array.isArray(result) ? result.map((d) => this.model.hydrate(d)) : this.model.hydrate(result)) as R;
  }

  then<A = R, B = never>(onfulfilled?: ((value: R) => A | PromiseLike<A>) | null, onrejected?: ((reason: any) => B | PromiseLike<B>) | null) {
    return this.exec().then(onfulfilled, onrejected);
  }
  catch<B = never>(onrejected?: ((reason: any) => B | PromiseLike<B>) | null) {
    return this.exec().catch(onrejected);
  }
}

export { applyProjection };
