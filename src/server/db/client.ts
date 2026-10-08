import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/server/env";
import * as schema from "@/server/db/schema";

export type Db = NodePgDatabase<typeof schema>;

// Reused across hot reloads in dev so `next dev` does not leak pools.
const globalForDb = globalThis as unknown as { pdPool?: Pool; pdDb?: Db };

export function getPool(): Pool {
  globalForDb.pdPool ??= new Pool({ connectionString: env().DATABASE_URL, max: 10 });
  return globalForDb.pdPool;
}

export function getDb(): Db {
  globalForDb.pdDb ??= drizzle(getPool(), { schema });
  return globalForDb.pdDb;
}

/** For tests and scripts: build a db bound to an explicit connection string. */
export function createDb(connectionString: string): { db: Db; pool: Pool } {
  const pool = new Pool({ connectionString, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}
