import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://design:design@localhost:5434/project_design_test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // Signed in as the e2e user (see e2e/global-setup.ts).
    storageState: "playwright/.auth/state.json",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/start-standalone.mjs",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      // GitHub mode, so sign-in gating is tested. Nothing here talks to GitHub.
      GITHUB_CLIENT_ID: "e2e-client",
      GITHUB_CLIENT_SECRET: "e2e-secret",
    },
  },
});
