/**
 * Turn stored Shiprocket "Order Placed" deliveries into shop orders (Admin → Orders, "My orders").
 *
 * The webhook does this as orders arrive; this catches up anything left unprocessed (orders that
 * arrived before the import existed, or an import that failed).
 *
 *   npx tsx --tsconfig ./tsconfig.json --conditions=react-server scripts/import-shiprocket-orders.ts
 *
 * Uses the database configured in the environment (.env.local's TURSO_* = the live database).
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

async function main() {
  const { importPendingShiprocketOrders } = await import("@/server/services/shiprocketOrderImport");
  const result = await importPendingShiprocketOrders();
  console.log(
    `Pending deliveries: ${result.pending}. Orders created: ${result.created}, not orders: ${result.skipped}, failed: ${result.failed}.`,
  );
  return result.failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
