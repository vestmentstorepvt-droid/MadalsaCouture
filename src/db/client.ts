import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client, type InStatement, type ResultSet, type Transaction } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Turso in production (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN). Locally, leave
// TURSO_DATABASE_URL unset and a SQLite file under .data/ is used.

export const LOCAL_DATABASE_URL = "file:.data/madalsa.db";

export function databaseUrl() {
  return process.env.TURSO_DATABASE_URL?.trim() || (process.env.NODE_ENV === "production" ? "" : LOCAL_DATABASE_URL);
}

function connect(): Client {
  const url = databaseUrl();
  if (!url) throw new Error("No database configured — set TURSO_DATABASE_URL.");
  if (url.startsWith("file:")) mkdirSync(dirname(url.slice(5)), { recursive: true });
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
}

const globalForDb = globalThis as unknown as { madalsaClient?: Client; madalsaReady?: Promise<void> };

/** The shared connection, opened once per server instance and reused by every request. */
export function client(): Client {
  if (!globalForDb.madalsaClient) {
    globalForDb.madalsaClient = connect();
    if (databaseUrl().startsWith("file:")) {
      // Local SQLite: wait for a busy writer instead of failing immediately.
      globalForDb.madalsaReady = globalForDb.madalsaClient
        .execute("PRAGMA busy_timeout = 5000")
        .then(() => globalForDb.madalsaClient!.execute("PRAGMA journal_mode = WAL"))
        .then(() => undefined)
        .catch(() => undefined);
    }
  }
  return globalForDb.madalsaClient;
}

/** Drizzle handle over the same connection (typed schema, raw `sql` queries). */
export function db() {
  return drizzle(client(), { schema });
}

/** Anything that can run SQL: the client itself or an open transaction. */
export type Executor = { execute(stmt: InStatement): Promise<ResultSet> };

const txStorage = new AsyncLocalStorage<Transaction>();

/** The transaction the current request is running in, or the plain client. */
export async function executor(): Promise<Executor> {
  const tx = txStorage.getStore();
  if (tx) return tx;
  await ready();
  return client();
}

export function inTransaction() {
  return Boolean(txStorage.getStore());
}

export async function ready() {
  client();
  await globalForDb.madalsaReady;
}

function isBusy(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /SQLITE_BUSY|database is locked|SQLITE_LOCKED/i.test(msg);
}

/**
 * Run `fn` inside a write transaction. Writes are serialised by SQLite, so the
 * body sees a consistent snapshot and its changes land all-or-nothing.
 * Busy errors (another writer holding the lock) are retried with backoff.
 */
export async function withTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const current = txStorage.getStore();
  if (current) return fn(current); // already inside a transaction: join it
  await ready();
  let attempt = 0;
  for (;;) {
    let tx: Transaction | undefined;
    try {
      tx = await client().transaction("write");
      const open = tx;
      const result = await txStorage.run(open, () => fn(open));
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx?.rollback();
      } catch {
        /* already closed */
      }
      if (isBusy(err) && attempt < 8) {
        attempt++;
        await new Promise((r) => setTimeout(r, 15 * 2 ** attempt + Math.random() * 20));
        continue;
      }
      throw err;
    } finally {
      tx?.close();
    }
  }
}
