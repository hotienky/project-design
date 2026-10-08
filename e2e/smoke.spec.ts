import { expect, test } from "@playwright/test";

import { TEAM_TASKS_EXAMPLE, teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { createDb } from "@/server/db/client";
import { createProject, getProjectBySlug } from "@/server/services/projects";

const DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://design:design@localhost:5434/project_design_test";

test.beforeAll(async () => {
  const { db, pool } = createDb(DATABASE_URL);
  if (!(await getProjectBySlug(db, TEAM_TASKS_EXAMPLE.slug))) {
    await createProject(db, { ...TEAM_TASKS_EXAMPLE, document: teamTasksDesign });
  }
  await pool.end();
});

test("renders the example design on the canvas without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Team Tasks" })).toBeVisible();
  await page.getByRole("link", { name: "Team Tasks" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(teamTasksDesign.nodes!.length);
  expect(errors).toEqual([]);
});
