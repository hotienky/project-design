/**
 * Runs once per server instance, before the first request is served: the
 * place to migrate the database on start-up.
 */
export async function register() {
  // The Edge runtime has no TCP sockets, so `pg` is only imported on Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { env } = await import("@/server/env");
  const config = env();
  if (!config.MIGRATE_ON_START) return;

  const { runMigrations } = await import("@/server/db/migrate");
  await runMigrations(config.DATABASE_URL);
  console.log("[migrate] database is up to date");
}
