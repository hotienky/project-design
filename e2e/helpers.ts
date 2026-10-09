import { sql } from "drizzle-orm";

import { createSession, upsertGithubUser } from "@/server/auth/sessions";
import { createDb } from "@/server/db/client";

export const DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://design:design@localhost:5434/project_design_test";

/** Where the global setup saves the signed-in browser state every spec starts from. */
export const STORAGE_STATE = "playwright/.auth/state.json";

/** Runs `fn` with a db bound to the e2e database, then closes the pool. */
export async function withDb<T>(fn: (db: ReturnType<typeof createDb>["db"]) => Promise<T>) {
  const { db, pool } = createDb(DATABASE_URL);
  try {
    return await fn(db);
  } finally {
    await pool.end();
  }
}

/** Empties the design tables; the signed-in e2e user and its session stay. */
export const resetDatabase = () =>
  withDb((db) =>
    db.execute(
      sql`truncate table component_status, api_tokens, project_versions, projects restart identity cascade`,
    ),
  );

/** The user every spec is signed in as (idempotent). */
export const e2eUser = () =>
  withDb((db) => upsertGithubUser(db, { id: 424242, login: "e2e-user", name: "E2E User" }));

/** Id of the signed-in user, for projects a spec creates directly in the database. */
export const ownerId = async () => (await e2eUser()).id;

export const newSession = (userId: string) => withDb((db) => createSession(db, userId));

export { syntheticDesign } from "../tests/helpers/synthetic-design";
