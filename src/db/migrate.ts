import { client, ready } from "./client";
import { MODELS } from "./models";
import { COLLECTION_NAMES } from "./schema";

// Tables + expression indexes. Every statement is idempotent, so this runs on
// the first request of each server instance (one batched round trip) and from
// `npm run db:migrate`.

export function schemaStatements(): string[] {
  const statements: string[] = [];
  for (const name of COLLECTION_NAMES) {
    statements.push(`CREATE TABLE IF NOT EXISTS "${name}" (id TEXT PRIMARY KEY NOT NULL, doc TEXT NOT NULL)`);
    for (const path of MODELS[name].sqlPaths) {
      const indexName = `idx_${name}_${path.replace(/\W/g, "_")}`;
      statements.push(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${name}" (json_extract(doc, '$.${path}'))`);
    }
  }
  statements.push(
    `CREATE TABLE IF NOT EXISTS processed_events (id TEXT PRIMARY KEY NOT NULL, source TEXT NOT NULL, processed_at INTEGER NOT NULL)`,
  );
  // Atomic counters for order numbers etc. (UPDATE … RETURNING).
  statements.push(`CREATE TABLE IF NOT EXISTS sequences (name TEXT PRIMARY KEY NOT NULL, value INTEGER NOT NULL)`);
  return statements;
}

const globalForMigrate = globalThis as unknown as { madalsaMigrated?: Promise<void> };

export function ensureSchema(): Promise<void> {
  globalForMigrate.madalsaMigrated ??= (async () => {
    await ready();
    await client().batch(schemaStatements(), "write");
  })().catch((err) => {
    globalForMigrate.madalsaMigrated = undefined;
    throw err;
  });
  return globalForMigrate.madalsaMigrated;
}
