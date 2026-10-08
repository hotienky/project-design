import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { expect, test, type Page } from "@playwright/test";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { createProject } from "@/server/services/projects";
import { resetDatabase, withDb } from "./helpers";

const SLUG = "example";

test.beforeEach(async () => {
  await resetDatabase();
  await withDb((db) =>
    createProject(db, { name: "Example", slug: SLUG, document: teamTasksDesign }),
  );
});
test.afterAll(resetDatabase);

const tab = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name });
const exportOf = async (page: Page, version: string) =>
  (await (await page.request.get(`/api/projects/${SLUG}/export?version=${version}`)).json())
    .document;

test("publish, diff, restore, scoped token, agent write-back and the brief", async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto(`/projects/${SLUG}`);
  await expect(page.locator(".react-flow__node")).toHaveCount(21);

  // Publish v1.
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByLabel("Label").fill("first cut");
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published v1")).toBeVisible();

  // Edit the draft: rename a module on the canvas.
  await page
    .locator('.react-flow__node[data-id="mod_usecases"]')
    .click({ position: { x: 3, y: 3 } });
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("Task use cases v2");
  await name.press("Enter");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Versions → View changes lists the edit.
  await tab(page, "Versions").click();
  await expect(page.getByRole("row", { name: /v1/ })).toContainText("first cut");
  await page.getByRole("button", { name: "View changes vs draft" }).click();
  await expect(page.getByTestId("diff")).toContainText(
    "~ Changed module **Task use cases v2** [mod_usecases]: name",
  );
  await page.keyboard.press("Escape");

  // Restore v1: the draft equals v1 again.
  await page.getByRole("button", { name: "Restore v1" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Restored v1 into the draft")).toBeVisible();
  await expect
    .poll(async () =>
      JSON.stringify(
        (await (await page.request.get(`/api/projects/${SLUG}/design`)).json()).document,
      ),
    )
    .toBe(JSON.stringify(await exportOf(page, "1")));
  await tab(page, "Canvas").click();
  await expect(page.locator('.react-flow__node[data-id="mod_usecases"]')).toContainText(
    "Task use cases",
  );
  await expect(page.locator('.react-flow__node[data-id="mod_usecases"]')).not.toContainText("v2");

  // A project-scoped token, created in Settings.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Create token" }).click();
  await page.getByLabel("Name").fill("agent");
  await page.getByLabel("Scope").click();
  await page.getByRole("option", { name: "Example" }).click();
  await page.getByRole("button", { name: "Create token" }).last().click();
  const token = await page.getByLabel("New token").inputValue();
  expect(token).toMatch(/^pd_/);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("row", { name: /agent/ })).toContainText("Example");

  // The agent reports progress over MCP, without naming the project.
  const client = new Client({ name: "e2e", version: "0.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("http://127.0.0.1:3100/api/mcp"), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  await client.callTool({
    name: "set_component_status",
    arguments: { id: "svc_api", status: "done", note: "scaffolded" },
  });

  // …and the green badge appears on the canvas within the polling interval.
  await page.goto(`/projects/${SLUG}`);
  await expect(
    page.locator('.react-flow__node[data-id="svc_api"] [data-status="done"]'),
  ).toBeVisible({ timeout: 12_000 });

  // The Brief tab shows exactly what get_project_brief returns.
  await tab(page, "Brief").click();
  const brief = await client.callTool({ name: "get_project_brief", arguments: {} });
  const expected = (brief.content as { text: string }[])[0]!.text;
  await expect(page.getByTestId("brief")).toContainText("status: done");
  await expect
    .poll(async () => (await page.getByTestId("brief").textContent())?.trim())
    .toBe(expected.trim());
  await client.close();
});

test("the other sections edit the design and persist", async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto(`/projects/${SLUG}/overview`);
  await page.waitForLoadState("networkidle"); // let React hydrate before typing into SSR'd inputs
  const summary = page.getByLabel("Summary");
  await summary.fill("A new summary");
  await summary.blur();
  await page.getByLabel("New Goals").fill("Ship it");
  await page.getByLabel("New Goals").press("Enter");

  await tab(page, "Stack").click();
  await expect(page.getByRole("heading", { name: "Tech stack" })).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Redis");
  await page.getByLabel("Name", { exact: true }).press("Enter");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: "Redis", exact: true })).toBeVisible();

  await tab(page, "Conventions").click();
  await expect(page.getByRole("heading", { name: "Conventions" })).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Rule", { exact: true }).fill("Prefer small modules");
  await dialog.getByRole("button", { name: "Add convention" }).click();
  await expect(page.getByText("Prefer small modules")).toBeVisible();

  await tab(page, "Decisions").click();
  await expect(page.getByRole("heading", { name: "Decisions" })).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Use Redis streams");
  await page.getByRole("dialog").getByLabel("Title").press("Enter");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /Use Redis streams/ })).toBeVisible();

  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const { document } = await (await page.request.get(`/api/projects/${SLUG}/design`)).json();
  expect(document.overview.summary).toBe("A new summary");
  expect(document.overview.goals).toContain("Ship it");
  expect(document.stack.map((s: { name: string }) => s.name)).toContain("Redis");
  expect(document.conventions.map((c: { rule: string }) => c.rule)).toContain(
    "Prefer small modules",
  );
  expect(document.decisions.map((d: { title: string }) => d.title)).toContain("Use Redis streams");
});
