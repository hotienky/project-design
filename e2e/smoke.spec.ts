import { expect, test } from "@playwright/test";

import { TEAM_TASKS_EXAMPLE, teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { createProject, getProjectBySlug } from "@/server/services/projects";
import { newSession, ownerId, withDb } from "./helpers";

test.beforeAll(async () => {
  const owner = await ownerId();
  await withDb(async (db) => {
    if (!(await getProjectBySlug(db, TEAM_TASKS_EXAMPLE.slug))) {
      await createProject(db, { ...TEAM_TASKS_EXAMPLE, ownerId: owner, document: teamTasksDesign });
    }
  });
});

test("renders the example design on the canvas without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/projects");
  await expect(page.getByRole("link", { name: "Team Tasks" })).toBeVisible();
  await page.getByRole("link", { name: "Team Tasks" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(teamTasksDesign.nodes!.length);
  expect(errors).toEqual([]);
});

test("the landing page links a signed-in user to their projects", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Design the system");
  await page.getByRole("link", { name: "Open your projects" }).first().click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("button", { name: "Account (e2e-user)" })).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows GitHub sign-in and keeps the app and its API behind it", async ({ page }) => {
    await page.goto("/");
    const signIn = page.getByRole("link", { name: "Sign in with GitHub" }).first();
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute("href", "/api/auth/github?next=%2Fprojects");

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/\?next=%2Fsettings$/);
    await expect(page.getByRole("link", { name: "Sign in with GitHub" }).first()).toHaveAttribute(
      "href",
      "/api/auth/github?next=%2Fsettings",
    );

    const api = await page.request.get(`/api/projects/${TEAM_TASKS_EXAMPLE.slug}/design`);
    expect(api.status()).toBe(401);
  });

  test("a forged session cookie is not enough", async ({ page, context }) => {
    await context.addCookies([
      { name: "pd_session", value: "forged", domain: "127.0.0.1", path: "/" },
    ]);
    const api = await page.request.get(`/api/projects/${TEAM_TASKS_EXAMPLE.slug}/design`);
    expect(api.status()).toBe(401);
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/$/);
  });
});

test("signing out ends the session", async ({ browser }) => {
  // A separate session, so the shared storage-state session stays valid for other specs.
  const session = await newSession(await ownerId());
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await context.addCookies([
    { name: "pd_session", value: session.token, domain: "127.0.0.1", path: "/" },
  ]);
  const page = await context.newPage();
  await page.goto("/projects");
  await page.getByRole("button", { name: "Account (e2e-user)" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Sign in with GitHub" }).first()).toBeVisible();
  expect((await page.request.get("/api/projects/x/design")).status()).toBe(401);
  await context.close();
});
