/** `npm run db:migrate`: apply migrations without starting the server. */
import { runMigrations } from "@/server/db/migrate";
import { env } from "@/server/env";

async function main() {
  await runMigrations(env().DATABASE_URL);
  console.log("[migrate] up to date");
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});
