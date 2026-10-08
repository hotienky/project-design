import { describe, expect, it } from "vitest";

import {
  removeChannel,
  removeElements,
  removeField,
  removeOperation,
  renameField,
  scrubEntityRefs,
} from "@/lib/design/edits";
import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { checkIntegrity, parseDesign } from "@/lib/design/integrity";
import type { DesignDocument } from "@/lib/design/schema";

const doc = () => parseDesign(teamTasksDesign);
const task = (d: DesignDocument) => {
  const n = d.nodes.find((x) => x.id === "ent_task")!;
  if (n.kind !== "entity") throw new Error("fixture");
  return n;
};

describe("document edits keep the design valid", () => {
  it("removeOperation clears calls edges", () => {
    const next = removeOperation(doc(), "api_rest", "op_create");
    const edge = next.edges.find((e) => e.id === "e_web_api");
    expect(edge?.kind === "calls" && edge.data.operations).toEqual(["op_list", "op_complete"]);
    expect(checkIntegrity(next)).toEqual([]);
  });

  it("removeChannel resets edges to any channel", () => {
    const next = removeChannel(doc(), "que_events", "ch_assigned");
    const edge = next.edges.find((e) => e.id === "e_repo_pub");
    expect(edge?.kind === "publishes" && edge.data.channelId).toBeNull();
    expect(checkIntegrity(next)).toEqual([]);
  });

  it("renameField updates indexes; removeField drops them from indexes", () => {
    const renamed = renameField(doc(), "ent_task", "status", "state");
    expect(task(renamed).data.indexes[0]!.fields).toEqual(["projectId", "state"]);
    expect(checkIntegrity(renamed)).toEqual([]);

    const removed = removeField(doc(), "ent_task", "status");
    expect(task(removed).data.indexes[0]!.fields).toEqual(["projectId"]);
    const empty = removeField(removed, "ent_task", "projectId");
    expect(task(empty).data.indexes).toEqual([]);
    expect(checkIntegrity(empty)).toEqual([]);
  });

  it("scrubEntityRefs detaches shapes and converts ref fields", () => {
    const d = doc();
    task(d).data.fields.push({
      ...task(d).data.fields[0]!,
      name: "owner",
      type: "ref",
      refEntityId: "ent_user",
      primary: false,
    });
    const gone = new Set(["ent_user", "ent_task"]);
    const withoutNodes = { ...d, nodes: d.nodes.filter((n) => !gone.has(n.id)) };
    const next = scrubEntityRefs(withoutNodes, gone);
    const api = next.nodes.find((n) => n.id === "api_rest");
    expect(api?.kind === "api" && api.data.operations[0]!.response?.entityId).toBeNull();
    expect(
      checkIntegrity({
        ...next,
        edges: next.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
      }),
    ).toEqual([]);
  });

  it("removeElements removes subtrees, their edges, scopes and entity refs", () => {
    const next = removeElements(doc(), { nodeIds: ["svc_api", "dst_pg"], edgeIds: ["e_web_api"] });
    expect(next.nodes.some((n) => n.id === "mod_usecases" || n.id === "ent_task")).toBe(false);
    expect(next.edges.some((e) => e.id === "e_web_api")).toBe(false);
    expect(next.stack.every((s) => !s.scope.includes("svc_api"))).toBe(true);
    expect(checkIntegrity(next)).toEqual([]);
    const d = doc();
    expect(removeElements(d, { nodeIds: ["ghost"] })).toBe(d);
  });
});
