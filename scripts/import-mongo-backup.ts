/**
 * Load a backup into Turso / the local SQLite file. Accepts either
 *   - a MongoDB backup (mongodump --gzip output: .tar.gz or folder), or
 *   - a backup made by `npm run db:backup` (.json.gz).
 *
 *   npm run db:import -- <backup.tar.gz | dump folder | madalsa-*.json.gz> [--replace]
 *
 * Every document is stored exactly as the old API serialised it: ObjectIds →
 * hex strings, Dates → ISO strings. Existing rows with the same _id are
 * replaced; with --replace every table is emptied first (fresh cutover import).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { deserialize } from "bson";
import { client } from "../src/db/client";
import { ensureSchema } from "../src/db/migrate";
import { COLLECTION_NAMES } from "../src/db/schema";

function findDumpDir(dir: string): string {
  const entries = readdirSync(dir);
  if (entries.some((e) => e.endsWith(".bson.gz") || e.endsWith(".bson"))) return dir;
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      const found = findDumpDir(p);
      if (found) return found;
    }
  }
  return "";
}

function readBson(file: string) {
  const raw = readFileSync(file);
  const buf = file.endsWith(".gz") ? gunzipSync(raw) : raw;
  const docs: Record<string, unknown>[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const size = buf.readInt32LE(offset);
    docs.push(deserialize(buf.subarray(offset, offset + size)));
    offset += size;
  }
  // JSON round trip = exactly what Express's res.json() produced.
  return docs.map((d) => JSON.parse(JSON.stringify(d)));
}

async function main() {
  const source = process.argv[2];
  const replace = process.argv.includes("--replace");
  if (!source || !existsSync(source)) {
    console.error("Usage: npm run db:import -- <backup.tar.gz | dump folder> [--replace]");
    process.exit(1);
  }
  if (source.endsWith(".json.gz")) {
    await ensureSchema();
    const data = JSON.parse(gunzipSync(readFileSync(source)).toString("utf8"));
    if (data.format !== "madalsa-web-backup/1") throw new Error("Unknown backup format.");
    const db = client();
    if (replace) await db.batch(COLLECTION_NAMES.map((name) => `DELETE FROM "${name}"`), "write");
    let count = 0;
    for (const [name, docs] of Object.entries<any[]>(data.collections)) {
      if (!COLLECTION_NAMES.includes(name as any)) continue;
      for (let i = 0; i < docs.length; i += 200) {
        await db.batch(
          docs.slice(i, i + 200).map((d) => ({ sql: `INSERT OR REPLACE INTO "${name}" (id, doc) VALUES (?, ?)`, args: [String(d._id), JSON.stringify(d)] })),
          "write",
        );
      }
      count += docs.length;
    }
    console.log(`Restored ${count} documents from ${source}.`);
    return;
  }
  let dir = source;
  if (source.endsWith(".tar.gz") || source.endsWith(".tgz")) {
    dir = mkdtempSync(join(tmpdir(), "madalsa-import-"));
    execFileSync("tar", ["-xzf", source, "-C", dir]);
  }
  const dumpDir = findDumpDir(dir);
  if (!dumpDir) throw new Error(`No .bson files found under ${dir}`);

  await ensureSchema();
  const db = client();
  const known = new Set<string>(COLLECTION_NAMES);

  if (replace) {
    await db.batch(COLLECTION_NAMES.map((name) => `DELETE FROM "${name}"`), "write");
    console.log("Emptied all tables (--replace).");
  }

  let total = 0;
  for (const file of readdirSync(dumpDir).filter((f) => /\.bson(\.gz)?$/.test(f)).sort()) {
    const name = file.replace(/\.bson(\.gz)?$/, "");
    if (!known.has(name)) {
      console.warn(`skip ${name}: not part of the app`);
      continue;
    }
    const docs = readBson(join(dumpDir, file));
    for (let i = 0; i < docs.length; i += 200) {
      const chunk = docs.slice(i, i + 200);
      await db.batch(
        chunk.map((d) => ({ sql: `INSERT OR REPLACE INTO "${name}" (id, doc) VALUES (?, ?)`, args: [String(d._id), JSON.stringify(d)] })),
        "write",
      );
    }
    total += docs.length;
    console.log(`${name.padEnd(26)} ${docs.length}`);
  }
  console.log(`Imported ${total} documents.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
