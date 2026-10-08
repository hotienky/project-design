import { describe, expect, it } from "vitest";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { checkIntegrity, parseDesign } from "@/lib/design/integrity";
import { createDesignerStore, isDirty } from "@/stores/designer-store";

const make = () =>
  createDesignerStore({ slug: "team-tasks", document: parseDesign(teamTasksDesign), revision: 3 });

describe("designer store", () => {
  it("adds nodes with defaults and marks the draft dirty", () => {
    const store = make();
    expect(isDirty(store.getState())).toBe(false);
    const id = store.getState().addNode("module", { x: 10, y: 10 }, "lyr_app");
    const node = store.getState().document.nodes.find((n) => n.id === id);
    expect(node).toMatchObject({ kind: "module", name: "New module", parentId: "lyr_app" });
    expect(isDirty(store.getState())).toBe(true);
    expect(checkIntegrity(store.getState().document)).toEqual([]);
  });

  it("connects with the most likely edge kind and refuses invalid ones", () => {
    const store = make();
    const s = store.getState();
    expect(s.connect("ent_user", "ent_project")).not.toBeNull();
    expect(store.getState().document.edges.at(-1)?.kind).toBe("relation");
    expect(store.getState().connect("ent_user", "svc_api")).toBeNull();
    expect(store.getState().connect("svc_api", "api_rest", "exposes")).toBeNull(); // exists
    expect(checkIntegrity(store.getState().document)).toEqual([]);
  });

  it("removes a container with its subtree, edges and scopes", () => {
    const store = make();
    store.getState().removeElements({ nodeIds: ["svc_api"] });
    const doc = store.getState().document;
    expect(doc.nodes.some((n) => n.id === "mod_repo")).toBe(false);
    expect(doc.edges.some((e) => e.source === "mod_repo")).toBe(false);
    expect(doc.stack.find((s) => s.id === "stk_api")?.scope).toEqual([]);
    expect(checkIntegrity(doc)).toEqual([]);
  });

  it("undoes and redoes document changes only", () => {
    const store = make();
    const original = store.getState().document;
    store.getState().commitGeometry([{ id: "svc_web", position: { x: 99, y: 99 } }]);
    store.getState().markSaving();
    const moved = store.getState().document;
    store.temporal.getState().undo();
    expect(store.getState().document).toBe(original);
    expect(store.getState().status).toBe("saving");
    store.temporal.getState().redo();
    expect(store.getState().document).toBe(moved);
  });

  it("tracks what the server has", () => {
    const store = make();
    store.getState().updateNode("svc_web", (n) => ({ ...n, name: "Website" }));
    const sent = store.getState().document;
    store.getState().markSaving();
    store.getState().updateNode("svc_web", (n) => ({ ...n, name: "Site" }));
    store.getState().markSaved(sent, 4);
    expect(store.getState().revision).toBe(4);
    expect(isDirty(store.getState())).toBe(true); // a newer edit is still pending
  });

  it("discards an edit that would make the document invalid and reports why", () => {
    const rejected: string[] = [];
    const store = createDesignerStore({
      slug: "x",
      document: parseDesign(teamTasksDesign),
      revision: 1,
      onReject: (m) => rejected.push(m),
    });
    const before = store.getState().document;
    // Two fields with the same name are an integrity error the server would refuse.
    store
      .getState()
      .updateNode("ent_task", (n) =>
        n.kind === "entity"
          ? { ...n, data: { ...n.data, fields: [...n.data.fields, { ...n.data.fields[0]! }] } }
          : n,
      );
    expect(store.getState().document).toBe(before);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toContain("duplicate field");
    expect(isDirty(store.getState())).toBe(false);
  });

  it("keeps references valid when operations, channels, fields and entities go away", () => {
    const store = make();
    store.getState().removeOperation("api_rest", "op_create");
    store.getState().removeChannel("que_events", "ch_assigned");
    store.getState().renameField("ent_task", "status", "state");
    store.getState().removeField("ent_task", "projectId");
    expect(checkIntegrity(store.getState().document)).toEqual([]);

    store.getState().removeElements({ nodeIds: ["ent_task"] });
    const doc = store.getState().document;
    const api = doc.nodes.find((n) => n.id === "api_rest");
    expect(api?.kind === "api" && api.data.operations.map((o) => o.response?.entityId)).toEqual([
      null,
      null,
    ]);
    expect(checkIntegrity(doc)).toEqual([]);
  });

  it("makes each cross-reference edit a single undo step", () => {
    const store = make();
    const original = store.getState().document;
    store.getState().removeOperation("api_rest", "op_create");
    store.temporal.getState().undo();
    expect(store.getState().document).toBe(original);
  });
});
