import { sql } from "drizzle-orm";

import { upsertGithubUser } from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";

/** Empties every table. Call in beforeEach of each integration test file. */
export async function resetDb(): Promise<void> {
  await getDb().execute(
    sql`truncate table component_status, api_tokens, project_versions, projects, sessions, users restart identity cascade`,
  );
}

/** A signed-up user (idempotent per login). */
export const testUser = (login = "alice", id = 1) =>
  upsertGithubUser(getDb(), { id, login, name: login });
