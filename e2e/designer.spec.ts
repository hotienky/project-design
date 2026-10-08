import { expect, test, type Page } from "@playwright/test";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { createProject } from "@/server/services/projects";
import type { DesignDocument } from "@/lib/design/schema";
import { resetDatabase, syntheticDesign, withDb } from "./helpers";

const SLUG = "designer";

test.beforeEach(async () => {
  await resetDatabase();
  await withDb((db) => createProject(db, { name: "Designer", slug: SLUG }));
});
test.afterAll(resetDatabase);

const getDoc = async (page: Page, slug = SLUG) => {
  const response = await page.request.get(`/api/projects/${slug}/design`);
  return (await response.json()) as { revision: number; document: DesignDocument };
};
const nodeOfKind = (doc: DesignDocument, kind: string) => doc.nodes.find((n) => n.kind === kind);
const pane = (page: Page) => page.locator(".react-flow__pane");

async function open(page: Page) {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto(`/projects/${SLUG}`);
  await expect(pane(page)).toBeVisible();
}

async function drop(page: Page, kind: string, at: { x: number; y: number }) {
  await page
    .getByRole("button", { name: `Add ${kind}` })
    .dragTo(pane(page), { targetPosition: at });
}

async function rename(page: Page, name: string) {
  const field = page.getByLabel("Name", { exact: true });
  await field.fill(name);
  await field.press("Enter");
}

async function connect(page: Page, from: string, to: string) {
  const source = page.locator(`.react-flow__node[data-id="${from}"] .react-flow__handle-right`);
  const target = page.locator(`.react-flow__node[data-id="${to}"] .react-flow__handle-left`);
  const sb = (await source.boundingBox())!;
  const tb = (await target.boundingBox())!;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("builds a design on the canvas, edits it, and everything persists", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);

  // A service from the palette, renamed in the inspector.
  await drop(page, "Service", { x: 330, y: 260 });
  await rename(page, "Billing");
  await expect(page.locator(".react-flow__node").filter({ hasText: "Billing" })).toHaveCount(1);

  // A layer dropped onto the service, then a module dropped onto the layer.
  await drop(page, "Layer", { x: 330, y: 260 });
  await rename(page, "Domain");
  await drop(page, "Module", { x: 330, y: 260 });
  await rename(page, "Invoice rules");

  await expect
    .poll(async () => {
      const { document } = await getDoc(page);
      const service = nodeOfKind(document, "service");
      const layer = nodeOfKind(document, "layer");
      const mod = nodeOfKind(document, "module");
      return [layer?.parentId === service?.id, mod?.parentId === layer?.id, service?.name];
    })
    .toEqual([true, true, "Billing"]);

  // A new API, connected from the module: two kinds fit, so pick "calls".
  await drop(page, "API", { x: 1000, y: 200 });
  await rename(page, "Billing API");
  await expect
    .poll(async () => nodeOfKind((await getDoc(page)).document, "api")?.name)
    .toBe("Billing API");
  const { document: before } = await getDoc(page);
  const moduleId = nodeOfKind(before, "module")!.id;
  const apiId = nodeOfKind(before, "api")!.id;
  await connect(page, moduleId, apiId);
  await page.getByRole("menuitem", { name: /calls/ }).click();
  await expect
    .poll(async () => (await getDoc(page)).document.edges.map((e) => [e.kind, e.source, e.target]))
    .toEqual([["calls", moduleId, apiId]]);

  // An entity with a field.
  await drop(page, "Entity", { x: 1000, y: 600 });
  await rename(page, "Invoice");
  await page.getByRole("button", { name: "Add field" }).click();
  await expect
    .poll(async () => {
      const entity = nodeOfKind((await getDoc(page)).document, "entity");
      return entity?.kind === "entity" ? entity.data.fields.map((f) => f.name) : null;
    })
    .toEqual(["field1"]);

  // Undo and redo through the toolbar: add field, rename, add entity.
  const count = () => page.locator(".react-flow__node").count();
  expect(await count()).toBe(5);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Undo/ }).click();
  await expect.poll(count).toBe(4);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Redo/ }).click();
  await expect.poll(count).toBe(5);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Reload: everything is still there, and the layer's parent is still the service.
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  const { document } = await getDoc(page);
  expect(nodeOfKind(document, "layer")!.parentId).toBe(nodeOfKind(document, "service")!.id);
  expect(errors).toEqual([]);
});

test("deleting a container removes what is nested in it", async ({ page }) => {
  await open(page);
  await drop(page, "Service", { x: 330, y: 260 });
  await drop(page, "Layer", { x: 330, y: 260 });
  await drop(page, "Module", { x: 330, y: 260 });
  await expect(page.locator(".react-flow__node")).toHaveCount(3);

  await page
    .locator(".react-flow__node.selectable")
    .first()
    .click({ position: { x: 12, y: 8 } });
  await page.keyboard.press("Delete");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("and its 2 nested components");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect.poll(async () => (await getDoc(page)).document.nodes.length).toBe(0);
});

test("refuses to drop a layer on empty canvas", async ({ page }) => {
  await open(page);
  await drop(page, "Layer", { x: 400, y: 300 });
  await expect(page.getByText(/must be dropped inside a service/)).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});

test("a second tab saving first shows the conflict dialog", async ({ page, context }) => {
  await open(page);
  await drop(page, "Service", { x: 330, y: 260 });
  await rename(page, "First");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const other = await context.newPage();
  await other.setViewportSize({ width: 1700, height: 1000 });
  await other.goto(`/projects/${SLUG}`);
  await expect(other.locator(".react-flow__node")).toHaveCount(1);
  await other.locator(".react-flow__node").click({ position: { x: 12, y: 8 } });
  await rename(other, "Second");
  await expect(other.getByText("Saved", { exact: true })).toBeVisible();

  await rename(page, "Third");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("This design changed somewhere else");
  await dialog.getByRole("button", { name: "Reload" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".react-flow__node").filter({ hasText: "Second" })).toHaveCount(1);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
});

test("opens a 300-node design without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await withDb((db) =>
    createProject(db, { name: "Big", slug: "big", document: syntheticDesign() as never }),
  );
  const started = Date.now();
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/projects/big");
  await expect(page.locator(".react-flow__node")).toHaveCount(310);
  expect(Date.now() - started).toBeLessThan(15_000);
  expect(errors).toEqual([]);
});

test("every inspector form renders, and edits keep the design valid", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await withDb((db) =>
    createProject(db, { name: "Example", slug: "example", document: teamTasksDesign }),
  );
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/projects/example");
  await expect(page.locator(".react-flow__node")).toHaveCount(21);

  const select = (id: string) =>
    page.locator(`.react-flow__node[data-id="${id}"]`).click({ position: { x: 3, y: 3 } });
  const inspector = page.getByRole("complementary", { name: "Inspector" });

  for (const id of [
    "svc_api",
    "lyr_app",
    "mod_usecases",
    "dst_pg",
    "ent_task",
    "api_rest",
    "int_email",
    "que_events",
    "act_member",
    "nte_scope",
  ]) {
    await select(id);
    await expect(inspector.getByLabel("Name", { exact: true })).toBeVisible();
  }

  // API: open an operation and rename it.
  await select("api_rest");
  await inspector.getByRole("button", { name: /listTasks/ }).click();
  await inspector.getByLabel("Name", { exact: true }).nth(1).fill("fetchTasks");
  await inspector.getByLabel("Name", { exact: true }).nth(1).press("Enter");

  // Queue: open the channel.
  await select("que_events");
  await inspector.getByRole("button", { name: "task.assigned" }).click();
  await expect(inspector.getByRole("button", { name: "Delete channel" })).toBeVisible();

  // Entity: rename a field that an index uses; the index must follow.
  await select("ent_task");
  const field = inspector.getByLabel("Field name 5");
  await expect(field).toHaveValue("status");
  await field.fill("state");
  await field.press("Enter");

  // Service: add an environment variable.
  await select("svc_notifier");
  await inspector.getByRole("button", { name: "Add variable" }).click();

  // An edge: pick its inspector.
  await page
    .locator('.react-flow__edge[data-id="e_web_api"] .react-flow__edge-interaction')
    .click({ force: true });
  await expect(inspector.getByText("calls", { exact: false }).first()).toBeVisible();
  await expect(inspector.getByLabel("fetchTasks")).toHaveCount(1);

  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const { document } = await getDoc(page, "example");
  const task = document.nodes.find((n) => n.id === "ent_task");
  expect(task?.kind === "entity" && task.data.indexes[0]!.fields).toEqual(["projectId", "state"]);
  const api = document.nodes.find((n) => n.id === "api_rest");
  expect(api?.kind === "api" && api.data.operations[0]!.name).toBe("fetchTasks");
  const notifier = document.nodes.find((n) => n.id === "svc_notifier");
  expect(notifier?.kind === "service" && notifier.data.env.map((v) => v.name)).toEqual([
    "RESEND_API_KEY",
    "NEW_VAR",
  ]);
  expect(errors).toEqual([]);
});

test("keyboard shortcuts undo, redo and save", async ({ page }) => {
  await open(page);
  await drop(page, "Service", { x: 330, y: 260 });
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await pane(page).click({ position: { x: 700, y: 600 } }); // leave the name field
  await page.keyboard.press("Control+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.keyboard.press("Control+y");
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect.poll(async () => (await getDoc(page)).document.nodes.length).toBe(1);
});

test("levels view drills from project to service to a controller's endpoints", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  const document = {
    ...teamTasksDesign,
    edges: [
      ...teamTasksDesign.edges!,
      {
        id: "e_routes_exposes",
        kind: "exposes",
        source: "mod_routes",
        target: "api_rest",
        data: { operations: ["op_list", "op_create"] },
      },
    ],
  };
  await withDb((db) =>
    createProject(db, { name: "Drill down", slug: "levels", document: document as never }),
  );
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.goto("/projects/levels");
  const nodes = page.locator(".react-flow__node");
  const node = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
  await expect(nodes).toHaveCount(teamTasksDesign.nodes!.length);

  // Project level: top-level nodes only, the API service collapsed to a summary card.
  await page.getByRole("button", { name: /^Levels/ }).click();
  const topLevel = teamTasksDesign.nodes!.filter((n) => !n.parentId).length;
  await expect(nodes).toHaveCount(topLevel);
  await expect(node("svc_api")).toContainText("4 inside");
  await expect(page.getByRole("navigation", { name: "Level" })).toContainText("Project");

  // Service level: layers and modules, plus the datastore and queue it talks to.
  await node("svc_api").dblclick();
  await expect(node("lyr_http")).toBeVisible();
  await expect(node("mod_routes")).toBeVisible();
  await expect(node("dst_pg").locator("[data-context]")).toBeVisible();
  await expect(node("dst_pg")).toContainText("Main database");
  await expect(node("svc_web")).toHaveCount(0);

  // Module level: the controller's endpoints.
  await page.getByRole("button", { name: "Open Task routes" }).click();
  const endpoints = page.getByRole("region", { name: "Endpoints" });
  await expect(endpoints).toContainText("listTasks");
  await expect(endpoints).toContainText("createTask");
  await expect(endpoints).not.toContainText("completeTask");
  await expect(page.getByRole("navigation", { name: "Level" })).toContainText("API");

  // Back up through the breadcrumb, then back to everything.
  await page
    .getByRole("navigation", { name: "Level" })
    .getByRole("button", { name: "Project" })
    .click();
  await expect(nodes).toHaveCount(topLevel);
  await page.getByRole("button", { name: /^All/ }).click();
  await expect(nodes).toHaveCount(teamTasksDesign.nodes!.length);
  expect(errors).toEqual([]);
});
