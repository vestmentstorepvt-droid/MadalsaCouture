import { randomBytes } from "node:crypto";

// MongoDB-compatible ObjectId strings (24 hex chars), so new records look exactly
// like the ones imported from the old database and sort by creation time.

const processUnique = randomBytes(5);
let counter = randomBytes(3).readUIntBE(0, 3);

export function newObjectId(date: Date = new Date()): string {
  const buf = Buffer.alloc(12);
  buf.writeUInt32BE(Math.floor(date.getTime() / 1000), 0);
  processUnique.copy(buf, 4);
  counter = (counter + 1) % 0xffffff;
  buf.writeUIntBE(counter, 9, 3);
  return buf.toString("hex");
}

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_RE.test(value);
}

/** Creation time encoded in an ObjectId. */
export function objectIdDate(id: string): Date {
  return new Date(parseInt(id.slice(0, 8), 16) * 1000);
}
