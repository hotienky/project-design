import { describe, expect, it } from "vitest";

import { diffDesigns, renderDiffMarkdown } from "@/lib/design/diff";
import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { indexDesign } from "@/lib/design/graph";
import { parseDesign } from "@/lib/design/integrity";
import type { DesignDocument } from "@/lib/design/schema";

const base = () => parseDesign(teamTasksDesign);
const edit = (fn: (d: DesignDocument) => void) => {
  const d = base();
  fn(d);
  return d;
};
const node = (d: DesignDocument, id: string) => d.nodes.find((n) => n.id === id)!;

describe("diffDesigns", () => {
  it("reports no change for identical documents", () => {
    expect(diffDesigns(base(), base()).isEmpty).toBe(true);
    expect(
      renderDiffMarkdown(diffDesigns(base(), base()), indexDesign(base()), indexDesign(base())),
    ).toBe("No changes.\n");
  });

  it("ignores moves and resizes", () => {
    const moved = edit((d) => {
      const n = node(d, "svc_api");
      n.position = { x: 5, y: 5 };
      n.size = { width: 9, height: 9 };
    });
    expect(diffDesigns(base(), moved).isEmpty).toBe(true);
  });

  it("reports a reparented node", () => {
    const after = edit((d) => {
      node(d, "mod_domain").parentId = "lyr_app";
    });
    const diff = diffDesigns(base(), after);
    expect(diff.nodes.changed.map((c) => [c.after.id, c.fields])).toEqual([
      ["mod_domain", ["parentId"]],
    ]);
  });

  it("reports added, changed and removed nodes with dotted data paths", () => {
    const after = edit((d) => {
      const task = node(d, "ent_task");
      if (task.kind === "entity") task.data.fields.push({ ...task.data.fields[0]!, name: "dueAt" });
      d.nodes = d.nodes.filter((n) => n.id !== "nte_scope");
      d.nodes.push({ ...node(d, "mod_routes"), id: "mod_audit", name: "Audit log" });
    });
    const diff = diffDesigns(base(), after);
    expect(diff.nodes.added.map((n) => n.id)).toEqual(["mod_audit"]);
    expect(diff.nodes.removed.map((n) => n.id)).toEqual(["nte_scope"]);
    expect(diff.nodes.changed).toHaveLength(1);
    expect(diff.nodes.changed[0]!.fields).toEqual(["data.fields"]);
    const md = renderDiffMarkdown(diff, indexDesign(after), indexDesign(base()));
    expect(md).toContain("+ Added module **Audit log** [mod_audit] in API › HTTP");
    expect(md).toContain("~ Changed entity **Task** [ent_task]: data.fields");
    expect(md).toContain("- Removed note **Scope** [nte_scope]");
  });

  it("covers overview, stack, conventions, decisions and edges", () => {
    const after = edit((d) => {
      d.overview.summary = "New summary";
      d.stack.push({
        id: "stk_x",
        category: "cache",
        name: "Redis",
        version: "8",
        notes: "",
        scope: [],
      });
      d.conventions = d.conventions.filter((c) => c.id !== "cnv_names");
      d.decisions[0]!.status = "superseded";
      d.edges = d.edges.filter((e) => e.id !== "e_http_app");
    });
    const diff = diffDesigns(base(), after);
    expect(diff.overview).toEqual(["summary"]);
    expect(diff.stack.added.map((s) => s.id)).toEqual(["stk_x"]);
    expect(diff.conventions.removed.map((c) => c.id)).toEqual(["cnv_names"]);
    expect(diff.decisions.changed[0]!.fields).toEqual(["status"]);
    expect(diff.edges.removed.map((e) => e.id)).toEqual(["e_http_app"]);
    const md = renderDiffMarkdown(diff, indexDesign(after), indexDesign(base()));
    expect(md).toContain("- Removed depends_on **HTTP** → **Application** [e_http_app]");
    expect(md).toContain("~ Changed: summary");
    expect(md).toContain("+ Added **Redis** 8 (cache) [stk_x]");
  });
});
