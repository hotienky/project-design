import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { resetDatabase } from "./helpers";

test.beforeEach(resetDatabase);
test.afterAll(resetDatabase);

async function createFromExample(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Example: Team Tasks").check();
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+$/);
}

async function openMenu(page: Page, project: string, item: string | RegExp) {
  await page.getByRole("button", { name: `Actions for ${project}`, exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("creates a project from the example and shows it on the canvas", async ({ page }) => {
  await createFromExample(page, "Example Project");
  await expect(page).toHaveURL(/\/projects\/example-project$/);
  await expect(page.locator(".react-flow__node")).toHaveCount(21);
});

test("renames, duplicates, exports, imports and deletes", async ({ page }) => {
  await createFromExample(page, "Alpha");
  await page.goto("/projects");
  await expect(page.getByText("21 components")).toBeVisible();

  await openMenu(page, "Alpha", "Rename");
  await page.getByLabel("Project name").fill("Beta");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: "Beta", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Alpha" })).toHaveCount(0);

  await openMenu(page, "Beta", "Duplicate");
  await expect(page.getByRole("link", { name: "Beta copy" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await openMenu(page, "Beta", "Export JSON");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("alpha-draft.design.json");
  const file = await download.path();
  expect(await readFile(file, "utf8")).toContain('"format": "project-design"');

  await page.locator('input[type="file"]').first().setInputFiles(file);
  await expect(page).toHaveURL(/\/projects\/alpha-2$/);
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: /^Beta/ })).toHaveCount(3);

  await openMenu(page, "Beta copy", "Delete");
  await expect(page.getByRole("alertdialog")).toContainText("Delete Beta copy?");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("link", { name: "Beta copy" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Beta/ })).toHaveCount(2);
});

test("shows the empty state", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByText("No designs yet")).toBeVisible();
});

test("rejects an invalid import with a message", async ({ page }) => {
  await page.goto("/projects");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, nodes: [{ kind: "nope" }] })),
    });
  await expect(page.getByText("The file is not a valid design")).toBeVisible();
});

test("creates a token once, lists its prefix, and revokes it", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Create token" }).click();
  await page.getByLabel("Name").fill("ci agent");
  await page.getByRole("button", { name: "Create token" }).last().click();

  const shown = page.getByLabel("New token");
  await expect(shown).toHaveValue(/^pd_[A-Za-z0-9_-]{43}$/);
  const token = await shown.inputValue();
  await expect(page.getByText("You won't see this token again.")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.reload();
  const row = page.getByRole("row", { name: /ci agent/ });
  await expect(row).toContainText(`${token.slice(0, 9)}…`);
  await expect(row).toContainText("All projects");
  await expect(page.getByText(token)).toHaveCount(0);

  await page.getByRole("button", { name: "Revoke ci agent" }).click();
  await page.getByRole("button", { name: "Revoke", exact: true }).click();
  await expect(row.getByText("Revoked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Revoke ci agent" })).toHaveCount(0);
});

test("theme can be switched", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
