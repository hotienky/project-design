import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://design:design@localhost:5434/project_design_test";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/**/*.integration.test.ts"],
          globalSetup: ["tests/setup/global-setup.ts"],
          // Files share one database; run them one after another.
          fileParallelism: false,
          // GitHub mode by default; local-mode tests mock isLocalMode.
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            MIGRATE_ON_START: "false",
            GITHUB_CLIENT_ID: "test-client",
            GITHUB_CLIENT_SECRET: "test-secret",
          },
        },
      },
    ],
  },
});
