import { describe, expect, it } from "vitest";

import { formatFieldType, formatShape, renderBrief } from "@/lib/design/brief";
import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { indexDesign } from "@/lib/design/graph";
import { parseDesign } from "@/lib/design/integrity";

const document = parseDesign(teamTasksDesign);
const project = { name: "Team Tasks", slug: "team-tasks", description: "Task tracker." };

describe("renderBrief", () => {
  it("matches the file snapshot", async () => {
    const brief = renderBrief({ project, document, revision: 12, version: null });
    await expect(brief).toMatchFileSnapshot("./__fixtures__/team-tasks.brief.md");
  });

  it("names the version when one is given and shows statuses", () => {
    const brief = renderBrief({
      project,
      document,
      revision: 3,
      version: { number: 3, label: "beta" },
      statuses: new Map([["svc_api", "done"]]),
    });
    expect(brief).toContain("version 3 (beta)");
    expect(brief).toContain("**API** [svc_api] — service · api · TypeScript / Fastify");
    expect(brief).toContain("status: done");
  });

  it("is deterministic and leaves out empty sections", () => {
    const empty = parseDesign({ schemaVersion: 1 });
    const a = renderBrief({ project, document: empty, revision: 1, version: null });
    expect(a).toBe(renderBrief({ project, document: empty, revision: 1, version: null }));
    expect(a).toContain("## Overview");
    expect(a).toContain("## Components");
    for (const heading of ["Tech stack", "Data model", "APIs", "Messaging", "Decisions", "Notes"]) {
      expect(a).not.toContain(`## ${heading}`);
    }
  });
});

describe("type formatting", () => {
  const index = indexDesign(document);
  const task = document.nodes.find((n) => n.id === "ent_task")!;
  if (task.kind !== "entity") throw new Error("fixture");

  it("formats shapes", () => {
    const base = { entityId: null, list: false, fields: [], description: "" };
    expect(formatShape(null, index)).toBe("—");
    expect(formatShape(base, index)).toBe("—");
    expect(formatShape({ ...base, entityId: "ent_task" }, index)).toBe("Task");
    expect(formatShape({ ...base, entityId: "ent_task", list: true }, index)).toBe("Task[]");
    const inline = [
      { ...task.data.fields[0]!, name: "title", type: "string" as const },
      { ...task.data.fields[0]!, name: "assigneeId", type: "uuid" as const, required: false },
    ];
    expect(formatShape({ ...base, fields: inline }, index)).toBe(
      "{ title: string, assigneeId?: uuid }",
    );
  });

  it("formats field types", () => {
    const status = task.data.fields.find((f) => f.name === "status")!;
    expect(formatFieldType(status, index)).toBe("enum(open|done)");
    expect(formatFieldType({ ...status, type: "ref", refEntityId: "ent_user" }, index)).toBe(
      "User",
    );
    expect(formatFieldType({ ...status, type: "string", list: true }, index)).toBe("string[]");
  });
});
