import "server-only";
import { withTransaction } from "@/db/client";
import { newObjectId } from "@/db/objectid";
import { Model } from "@/db/odm";
import { collection } from "@/db/store";
import type { CollectionName } from "@/db/schema";
import { registry } from "../models/registry";

// The parts of the `mongoose` API the ported services touch, backed by Turso.

export class ObjectId {
  private hex: string;
  constructor(id?: string | ObjectId) {
    this.hex = id === undefined || id === null ? newObjectId() : String(id instanceof ObjectId ? id.toHexString() : id);
  }
  toHexString() {
    return this.hex;
  }
  toString() {
    return this.hex;
  }
  toJSON() {
    return this.hex;
  }
  equals(other: unknown) {
    return String(other) === this.hex;
  }
  getTimestamp() {
    return new Date(parseInt(this.hex.slice(0, 8), 16) * 1000);
  }
  static isValid(value: unknown) {
    if (value instanceof ObjectId) return true;
    if (typeof value === "number") return true;
    if (typeof value !== "string") return false;
    const str: string = value;
    return /^[0-9a-fA-F]{24}$/.test(str) || str.length === 12;
  }
  static createFromHexString(hex: string) {
    return new ObjectId(hex);
  }
}

const Types = { ObjectId };

function rawCollection(name: string) {
  const store = collection(name as CollectionName);
  return {
    findOneAndUpdate: (filter: any, update: any, opts: any = {}) =>
      store.findOneAndUpdate(filter, update, { upsert: opts.upsert, new: opts.returnDocument === "after" }),
    findOne: (filter: any) => store.findOne(filter),
    find: (filter: any) => ({ toArray: () => store.find(filter) }),
    insertOne: async (doc: any) => ({ insertedId: (await store.create(doc))._id }),
    updateOne: (filter: any, update: any, opts: any = {}) => store.updateOne(filter, update, opts),
    countDocuments: (filter: any) => store.count(filter),
  };
}

const mongoose = {
  Types,
  models: registry as Record<string, Model<any>>,
  model(name: string) {
    const m = registry[name];
    if (!m) throw new Error(`Schema hasn't been registered for model "${name}".`);
    return m;
  },
  isValidObjectId: (v: unknown) => ObjectId.isValid(v),
  connection: {
    db: { collection: rawCollection },
    readyState: 1,
  },
  /** Sessions map onto one Turso write transaction. */
  async startSession() {
    return {
      withTransaction: <T>(fn: () => Promise<T>) => withTransaction(() => fn()),
      startTransaction() {},
      async commitTransaction() {},
      async abortTransaction() {},
      async endSession() {},
      inTransaction: () => false,
    };
  },
};

export default mongoose;
