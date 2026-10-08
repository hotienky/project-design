import { describe, expect, it } from "vitest";

import { keepMeasured, toFlowEdges, toFlowNodes } from "@/components/designer/to-flow";
import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { parseDesign } from "@/lib/design/integrity";

const doc = parseDesign(teamTasksDesign);

describe("toFlowNodes", () => {
  const nodes = toFlowNodes(doc, { svc_api: { status: "done", note: "" } }, new Set(["mod_repo"]));

  it("keeps parents before children and uses the kind as node type", () => {
    const index = new Map(nodes.map((n, i) => [n.id, i]));
    for (const n of nodes) {
      if (n.parentId) expect(index.get(n.parentId)!).toBeLessThan(index.get(n.id)!);
    }
    expect(nodes.find((n) => n.id === "svc_api")?.type).toBe("service");
  });

  it("sizes containers only, with positions relative to the parent", () => {
    const api = nodes.find((n) => n.id === "svc_api")!;
    expect([api.width, api.height, api.zIndex]).toEqual([520, 520, 0]);
    const routes = nodes.find((n) => n.id === "mod_routes")!;
    expect(routes.width).toBeUndefined();
    expect(routes.parentId).toBe("lyr_http");
    expect(routes.position).toEqual({ x: 20, y: 20 });
    expect(routes.zIndex).toBe(1);
  });

  it("marks the selection and attaches statuses", () => {
    expect(nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(["mod_repo"]);
    expect(nodes.find((n) => n.id === "svc_api")?.data.status?.status).toBe("done");
    expect(nodes.find((n) => n.id === "svc_web")?.data.status).toBeNull();
  });

  it("never constrains dragging to the parent", () => {
    expect(nodes.every((n) => n.extent === undefined)).toBe(true);
  });

  it("keepMeasured carries measured sizes over", () => {
    const previous = nodes.map((n) => ({ ...n, measured: { width: 10, height: 20 } }));
    const rebuilt = keepMeasured(toFlowNodes(doc, {}, new Set()), previous);
    expect(rebuilt.every((n) => n.measured?.width === 10)).toBe(true);
    expect(keepMeasured(toFlowNodes(doc, {}, new Set()), []).every((n) => !n.measured)).toBe(true);
  });
});

describe("toFlowEdges", () => {
  it("maps every edge to the design edge type", () => {
    const edges = toFlowEdges(doc, new Set(["e_web_api"]));
    expect(edges).toHaveLength(doc.edges.length);
    expect(edges.every((e) => e.type === "design")).toBe(true);
    expect(edges.find((e) => e.id === "e_web_api")?.selected).toBe(true);
    expect(edges.find((e) => e.id === "e_web_api")?.data?.edge.kind).toBe("calls");
  });

  it("captions edges with the detail of their kind", () => {
    const caption = (id: string) =>
      toFlowEdges(doc, new Set()).find((e) => e.id === id)?.data?.caption;
    expect(caption("e_web_api")).toBe("calls · http");
    expect(caption("e_repo_db")).toBe("accesses · read-write");
    expect(caption("e_project_tasks")).toBe("1—N");
    expect(caption("e_repo_pub")).toBe("publishes · task.assigned");
    expect(caption("e_http_app")).toBe("depends on");
  });

  it("animates messaging edges only", () => {
    const animated = toFlowEdges(doc, new Set())
      .filter((e) => e.animated)
      .map((e) => e.id);
    expect(animated.sort()).toEqual(["e_notifier_sub", "e_repo_pub"]);
  });
});
