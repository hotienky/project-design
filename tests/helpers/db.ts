import { sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";

/** Empties every table. Call in beforeEach of each integration test file. */
export async function resetDb(): Promise<void> {
  await getDb().execute(
    sql`truncate table component_status, api_tokens, project_versions, projects restart identity cascade`,
  );
}
