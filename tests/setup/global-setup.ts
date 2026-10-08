import { runMigrations } from "@/server/db/migrate";

/** Migrates the test database once per `vitest run`. */
export default async function setup() {
  const url =
    process.env.DATABASE_URL_TEST ?? "postgres://design:design@localhost:5434/project_design_test";
  try {
    await runMigrations(url);
  } catch (error) {
    throw new Error(
      `Cannot migrate the test database at ${url}. Is it running? Try \`npm run db:up\`.\n${String(error)}`,
    );
  }
}
