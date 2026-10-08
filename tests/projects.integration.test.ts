import { beforeEach, describe, expect, it } from "vitest";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { parseDesign } from "@/lib/design/integrity";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import {
  createProject,
  deleteProject,
  duplicateProject,
  exportProject,
  getProject,
  importProject,
  listProjects,
  saveDraft,
  updateProjectMeta,
} from "@/server/services/projects";
import { createToken } from "@/server/services/tokens";
import { publishVersion } from "@/server/services/versions";
import { setComponentStatus } from "@/server/services/status";
import { resetDb } from "./helpers/db";

const db = getDb();
const example = () => parseDesign(teamTasksDesign);

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
}

describe("projects service", () => {
  beforeEach(resetDb);

  it("derives slugs from names and resolves collisions", async () => {
    const a = await createProject(db, { name: "Team Tasks" });
    const b = await createProject(db, { name: "Team Tasks" });
    const c = await createProject(db, { name: "Team Tasks", slug: "team-tasks" });
    expect([a.slug, b.slug, c.slug]).toEqual(["team-tasks", "team-tasks-2", "team-tasks-3"]);
    expect(a.document.nodes).toEqual([]);
    expect(a.revision).toBe(1);
  });

  it("rejects an invalid slug and an invalid document", async () => {
    expect((await rejection(createProject(db, { name: "x", slug: "Bad Slug" }))).code).toBe(
      "VALIDATION",
    );
    await expect(
      createProject(db, { name: "x", document: { schemaVersion: 2 } as never }),
    ).rejects.toThrow();
  });

  it("lists projects with version and component counts, newest first", async () => {
    const first = await createProject(db, { name: "First" });
    await createProject(db, { name: "Second", document: teamTasksDesign });
    await publishVersion(db, first.slug, {});
    const rows = await listProjects(db);
    expect(rows.map((r) => r.slug)).toEqual(["second", "first"]);
    expect(rows[0]).toMatchObject({ latestVersion: null, nodeCount: 21, revision: 1 });
    expect(rows[1]).toMatchObject({ latestVersion: 1, nodeCount: 0 });
  });

  it("saveDraft increments the revision", async () => {
    await createProject(db, { name: "P" });
    const saved = await saveDraft(db, "p", { revision: 1, document: example() });
    expect(saved.revision).toBe(2);
    const row = await getProject(db, "p");
    expect(row.revision).toBe(2);
    expect(row.document.nodes).toHaveLength(21);
  });

  it("saveDraft rejects a stale revision with the current one", async () => {
    await createProject(db, { name: "P" });
    await saveDraft(db, "p", { revision: 1, document: example() });
    const error = await rejection(saveDraft(db, "p", { revision: 1, document: example() }));
    expect(error.code).toBe("CONFLICT");
    expect(error.details).toEqual({ currentRevision: 2 });
  });

  it("saveDraft rejects an invalid document with issue codes", async () => {
    await createProject(db, { name: "P" });
    const bad = {
      ...example(),
      edges: [{ id: "e", kind: "depends_on", source: "nope", target: "x" }],
    };
    const error = await rejection(saveDraft(db, "p", { revision: 1, document: bad }));
    expect(error.code).toBe("VALIDATION");
    expect((error.details as { code: string }[]).map((i) => i.code)).toContain(
      "edge.unknown_endpoint",
    );
    expect((await getProject(db, "p")).revision).toBe(1);
  });

  it("saveDraft reports NOT_FOUND for an unknown project", async () => {
    expect(
      (await rejection(saveDraft(db, "nope", { revision: 1, document: example() }))).code,
    ).toBe("NOT_FOUND");
  });

  it("lets exactly one of two concurrent saves with the same revision win", async () => {
    await createProject(db, { name: "P" });
    const results = await Promise.allSettled([
      saveDraft(db, "p", { revision: 1, document: example() }),
      saveDraft(db, "p", { revision: 1, document: example() }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((lost.reason as AppError).code).toBe("CONFLICT");
    expect((await getProject(db, "p")).revision).toBe(2);
  });

  it("renames without bumping the revision and guards slug changes", async () => {
    await createProject(db, { name: "A" });
    await createProject(db, { name: "B" });
    const renamed = await updateProjectMeta(db, "a", { name: "Alpha", slug: "alpha" });
    expect(renamed).toMatchObject({ name: "Alpha", slug: "alpha", revision: 1 });
    expect((await rejection(updateProjectMeta(db, "alpha", { slug: "b" }))).code).toBe("CONFLICT");
    expect((await rejection(updateProjectMeta(db, "alpha", { slug: "Not Valid" }))).code).toBe(
      "VALIDATION",
    );
    expect((await rejection(updateProjectMeta(db, "ghost", { name: "x" }))).code).toBe("NOT_FOUND");
  });

  it("duplicates the draft only", async () => {
    const original = await createProject(db, { name: "Orig", document: teamTasksDesign });
    await publishVersion(db, original.slug, {});
    const copy = await duplicateProject(db, "orig", { name: "Copy" });
    expect(copy.slug).toBe("copy");
    expect(copy.document).toEqual(original.document);
    expect(
      await listProjects(db).then((r) => r.find((p) => p.slug === "copy")?.latestVersion),
    ).toBeNull();
  });

  it("imports an envelope and a bare document, and rejects bad files", async () => {
    const source = await createProject(db, { name: "Source", document: teamTasksDesign });
    const envelope = await exportProject(db, "source", "draft");
    const fromEnvelope = await importProject(db, JSON.parse(JSON.stringify(envelope)));
    expect(fromEnvelope).toMatchObject({ name: "Source", slug: "source-2" });
    const bare = await importProject(db, teamTasksDesign);
    expect(bare).toMatchObject({ name: "Imported design", slug: "imported-design" });

    const invalid = await rejection(
      importProject(db, { schemaVersion: 1, nodes: [{ kind: "nope" }] }),
    );
    expect(invalid.code).toBe("VALIDATION");
    await expect(
      importProject(db, { format: "project-design", formatVersion: 7 }),
    ).rejects.toThrow();
    expect(source.revision).toBe(1);
  });

  it("round-trips export → import", async () => {
    const source = await createProject(db, { name: "Source", document: teamTasksDesign });
    const copy = await importProject(db, await exportProject(db, "source", "draft"));
    expect(copy.document).toEqual(source.document);
  });

  it("deletes a project with its versions, tokens and statuses", async () => {
    const p = await createProject(db, { name: "Doomed", document: teamTasksDesign });
    await publishVersion(db, "doomed", {});
    await createToken(db, { name: "scoped", projectId: p.id });
    await setComponentStatus(db, p.id, "svc_api", { status: "done" });
    await deleteProject(db, "doomed");
    const count = async (table: string) =>
      Number((await db.execute(`select count(*)::int as n from ${table}`)).rows[0]!.n as number);
    expect(await count("projects")).toBe(0);
    expect(await count("project_versions")).toBe(0);
    expect(await count("api_tokens")).toBe(0);
    expect(await count("component_status")).toBe(0);
    expect((await rejection(deleteProject(db, "doomed"))).code).toBe("NOT_FOUND");
  });

  it("hides other projects from a scoped principal", async () => {
    const a = await createProject(db, { name: "A" });
    await createProject(db, { name: "B" });
    const principal = { tokenId: "t", projectId: a.id };
    expect((await listProjects(db, principal)).map((p) => p.slug)).toEqual(["a"]);
    expect((await rejection(getProject(db, "b", principal))).code).toBe("NOT_FOUND");
  });
});
