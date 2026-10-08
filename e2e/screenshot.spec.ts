import { test } from "@playwright/test";

import { TEAM_TASKS_EXAMPLE, teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { createProject } from "@/server/services/projects";
import { resetDatabase, withDb } from "./helpers";

// Not part of the normal run. `npm run docs:screenshot` regenerates docs/screenshot.png.
test.skip(!process.env.SCREENSHOT, "set SCREENSHOT=1 to regenerate docs/screenshot.png");

test("README screenshot", async ({ page }) => {
  await resetDatabase();
  await withDb((db) => createProject(db, { ...TEAM_TASKS_EXAMPLE, document: teamTasksDesign }));
  await page.setViewportSize({ width: 1900, height: 1000 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/projects/team-tasks");
  await page.locator(".react-flow__node").first().waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "docs/screenshot.png" });
  await resetDatabase();
});
