import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

// Every replica runs this on boot, so the work is serialised behind a
// session-level advisory lock. The key is arbitrary but must never change.
const MIGRATION_LOCK_KEY = 7_316_402_118;

/** Applies pending SQL migrations from ./drizzle. Safe to call concurrently. */
export async function runMigrations(connectionString: string): Promise<void> {
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await migrate(drizzle(client), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
    await client.end();
  }
}
