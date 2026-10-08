import { beforeEach, describe, expect, it } from "vitest";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { parseDesign } from "@/lib/design/integrity";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { createProject, getProject, saveDraft } from "@/server/services/projects";
import {
  getVersion,
  listVersions,
  publishVersion,
  resolveDocument,
  restoreVersion,
} from "@/server/services/versions";
import { resetDb } from "./helpers/db";

const db = getDb();

async function code(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  return (error as AppError).code;
}

/** Saves the example with one extra tag so the draft differs from earlier versions. */
async function editDraft(slug: string, tag: string) {
  const row = await getProject(db, slug);
  const doc = structuredClone(row.document);
  doc.nodes[0]!.tags.push(tag);
  return saveDraft(db, slug, { revision: row.revision, document: doc });
}

describe("versions service", () => {
  beforeEach(resetDb);

  it("numbers versions 1, 2 and refuses to publish an unchanged draft", async () => {
    await createProject(db, { name: "P", document: teamTasksDesign });
    expect(await publishVersion(db, "p", { label: "first", notes: "n" })).toMatchObject({
      version: 1,
    });
    expect(await code(publishVersion(db, "p", {}))).toBe("VALIDATION");
    await editDraft("p", "changed");
    expect(await publishVersion(db, "p", {})).toMatchObject({ version: 2 });

    const list = await listVersions(db, "p");
    expect(list.map((v) => [v.version, v.label, v.nodeCount])).toEqual([
      [2, "", 21],
      [1, "first", 21],
    ]);
    expect(list[1]!.sourceRevision).toBe(1);
    expect(list[0]!.sourceRevision).toBe(2);
  });

  it("allows only one of two concurrent publishes of the same change", async () => {
    await createProject(db, { name: "P", document: teamTasksDesign });
    const results = await Promise.allSettled([
      publishVersion(db, "p", {}),
      publishVersion(db, "p", {}),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await listVersions(db, "p")).toHaveLength(1);
  });

  it("resolves draft, latest, a number, and reports missing ones", async () => {
    await createProject(db, { name: "P", document: teamTasksDesign });
    expect(await code(resolveDocument(db, "p", "latest"))).toBe("NOT_FOUND");
    expect(await resolveDocument(db, "p", "draft")).toMatchObject({ revision: 1, version: null });

    await publishVersion(db, "p", { label: "v1" });
    await editDraft("p", "changed");
    const latest = await resolveDocument(db, "p", "latest");
    expect(latest.version).toEqual({ number: 1, label: "v1" });
    expect(latest.document.nodes[0]!.tags).toEqual([]);
    expect((await resolveDocument(db, "p", "draft")).document.nodes[0]!.tags).toEqual(["changed"]);
    expect((await resolveDocument(db, "p", 1)).version?.number).toBe(1);
    expect(await code(resolveDocument(db, "p", 9))).toBe("NOT_FOUND");
    expect(await code(getVersion(db, "p", 9))).toBe("NOT_FOUND");
  });

  it("restores a version into the draft, honouring the revision", async () => {
    await createProject(db, { name: "P", document: teamTasksDesign });
    await publishVersion(db, "p", {});
    await editDraft("p", "changed");
    const current = await getProject(db, "p");

    expect(await code(restoreVersion(db, "p", 1, { revision: 1 }))).toBe("CONFLICT");
    const restored = await restoreVersion(db, "p", 1, { revision: current.revision });
    expect(restored.revision).toBe(current.revision + 1);
    expect((await getProject(db, "p")).document).toEqual(parseDesign(teamTasksDesign));
  });
});
