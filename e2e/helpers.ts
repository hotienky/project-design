import { sql } from "drizzle-orm";

import { createDb } from "@/server/db/client";

export const DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://design:design@localhost:5434/project_design_test";

/** Runs `fn` with a db bound to the e2e database, then closes the pool. */
export async function withDb<T>(fn: (db: ReturnType<typeof createDb>["db"]) => Promise<T>) {
  const { db, pool } = createDb(DATABASE_URL);
  try {
    return await fn(db);
  } finally {
    await pool.end();
  }
}

export const resetDatabase = () =>
  withDb((db) =>
    db.execute(
      sql`truncate table component_status, api_tokens, project_versions, projects restart identity cascade`,
    ),
  );

export { syntheticDesign } from "../tests/helpers/synthetic-design";
