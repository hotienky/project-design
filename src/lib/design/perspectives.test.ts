import { describe, expect, it } from "vitest";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { parseDesign } from "@/lib/design/integrity";
import {
  apiPerspective,
  designIdOf,
  layersPerspective,
  type PerspectiveView,
} from "@/lib/design/perspectives";

const doc = parseDesign(teamTasksDesign);
const all = { viewMode: "all", focusId: null } as const;
const overview = { viewMode: "levels", focusId: null } as const;
const edgeKeys = (view: PerspectiveView) =>
  view.edges.map((e) => `${e.id}:${e.source}>${e.target}${e.lifted ? `×${e.lifted}` : ""}`).sort();
const node = (view: PerspectiveView, id: string) => view.nodes.find((n) => n.id === id);

describe("designIdOf", () => {
  it("strips the copy prefix", () => {
    expect(designIdOf("api_rest~c~mod_web_tasks")).toBe("mod_web_tasks");
    expect(designIdOf("svc_web~direct")).toBe("direct");
    expect(designIdOf("mod_repo")).toBe("mod_repo");
  });
});

describe("apiPerspective", () => {
  it("shows implementers left and actual consumers right in the all view", () => {
    const view = apiPerspective(doc, all);
    const api = node(view, "api_rest")!;
    expect(api.role).toBe("api");
    const impl = node(view, "api_rest~i~svc_api")!;
    const consumer = node(view, "api_rest~c~mod_web_tasks")!;
    expect(impl.position.x).toBeLessThan(api.position.x);
    expect(consumer.position.x).toBeGreaterThan(api.position.x);
    expect(consumer.label).toBe("Web");
    expect(edgeKeys(view)).toEqual([
      "e_api_exposes:api_rest~i~svc_api>api_rest",
      "e_web_api:api_rest~c~mod_web_tasks>api_rest",
    ]);
    expect(view.empty).toBeNull();
  });

  it("lifts endpoints to the current level in the overview", () => {
    const view = apiPerspective(doc, overview);
    expect(edgeKeys(view)).toContain("lift:calls:svc_web:api_rest:api_rest~c~svc_web>api_rest×1");
    expect(edgeKeys(view)).toContain("e_api_exposes:api_rest~i~svc_api>api_rest");
  });

  it("keeps only the APIs the focus touches", () => {
    const web = apiPerspective(doc, { viewMode: "levels", focusId: "svc_web" });
    expect(edgeKeys(web)).toContain("e_web_api:api_rest~c~mod_web_tasks>api_rest");
    const notifier = apiPerspective(doc, { viewMode: "levels", focusId: "svc_notifier" });
    expect(notifier.nodes).toEqual([]);
    expect(notifier.empty).toMatch(/Notifier/);
  });
});

describe("layersPerspective", () => {
  it("stacks a service's layers in depends_on order with modules inside", () => {
    const view = layersPerspective(doc, all);
    const bands = view.nodes.filter((n) => n.role === "band" && n.parentId === "svc_api");
    const order = bands.map((b) => b.id);
    expect(order.indexOf("lyr_http")).toBeLessThan(order.indexOf("lyr_app"));
    expect(order.at(-1)).toBe("lyr_domain");
    const ys = bands.map((b) => b.position.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(node(view, "mod_routes")?.parentId).toBe("lyr_http");
    // Modules straight inside a service get their own band.
    expect(node(view, "svc_web~direct")?.label).toBe("Not in a layer");
    expect(node(view, "mod_web_tasks")?.parentId).toBe("svc_web~direct");
    expect(edgeKeys(view)).toContain("e_http_app:lyr_http>lyr_app");
    expect(edgeKeys(view)).toContain("e_routes_uc:mod_routes>mod_usecases");
    expect(view.edges.some((e) => e.violation)).toBe(false);
  });

  const broken = parseDesign({
    ...teamTasksDesign,
    edges: [
      ...(teamTasksDesign.edges ?? []),
      { id: "e_bad", kind: "depends_on", source: "mod_domain", target: "mod_repo" },
    ],
  });

  it("flags module dependencies that break the layer rules", () => {
    const view = layersPerspective(broken, all);
    expect(view.edges.find((e) => e.id === "e_bad")?.violation).toBe(true);
  });

  it("collapses bands and lifts only violations in the overview", () => {
    const view = layersPerspective(broken, overview);
    expect(view.nodes.some((n) => n.role === "card")).toBe(false);
    expect(node(view, "lyr_http")?.count).toBe(1);
    const lifted = view.edges.filter((e) => e.lifted);
    expect(lifted.map((e) => e.id)).toEqual(["lift:depends_on:lyr_domain:lyr_infra"]);
    expect(lifted[0]!.violation).toBe(true);
  });

  it("scopes to the focus's service", () => {
    const view = layersPerspective(doc, { viewMode: "levels", focusId: "lyr_app" });
    expect(view.nodes.filter((n) => n.role === "frame").map((n) => n.id)).toEqual(["svc_api"]);
    const db = layersPerspective(doc, { viewMode: "levels", focusId: "dst_pg" });
    expect(db.nodes).toEqual([]);
    expect(db.empty).toMatch(/isn't part of a service/);
  });
});
