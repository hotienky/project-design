import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { readImport, toEnvelope } from "@/lib/design/export-format";
import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { parseDesign } from "@/lib/design/integrity";

const project = { name: "Team Tasks", slug: "team-tasks", description: "d" };

describe("export format", () => {
  it("round-trips an envelope through JSON", () => {
    const doc = parseDesign(teamTasksDesign);
    const envelope = toEnvelope(project, doc, { number: 2, label: "beta" });
    expect(envelope.format).toBe("project-design");
    const read = readImport(JSON.parse(JSON.stringify(envelope)));
    expect(read.project).toEqual(project);
    expect(parseDesign(read.document)).toEqual(doc);
  });

  it("accepts a bare document", () => {
    const read = readImport(teamTasksDesign);
    expect(read.project).toBeNull();
    expect(parseDesign(read.document).nodes.length).toBeGreaterThan(0);
  });

  it("rejects a malformed envelope", () => {
    expect(() => readImport({ format: "project-design", formatVersion: 9 })).toThrow(ZodError);
  });
});
