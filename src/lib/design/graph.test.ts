import { describe, expect, it } from "vitest";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { indexDesign } from "@/lib/design/graph";
import { parseDesign } from "@/lib/design/integrity";

const index = () => indexDesign(parseDesign(teamTasksDesign));

describe("indexDesign", () => {
  it("looks up nodes and builds paths", () => {
    const i = index();
    expect(i.node("svc_api")?.name).toBe("API");
    expect(i.node("nope")).toBeUndefined();
    expect(i.path("mod_usecases")).toBe("API › Application › Task use cases");
  });

  it("lists children sorted by position and ancestors nearest first", () => {
    const i = index();
    expect(i.children("svc_api").map((n) => n.id)).toEqual([
      "lyr_http",
      "lyr_app",
      "lyr_domain",
      "lyr_infra",
    ]);
    expect(i.children(null).map((n) => n.id)).toContain("svc_web");
    expect(i.ancestors("mod_usecases").map((n) => n.id)).toEqual(["lyr_app", "svc_api"]);
    expect(i.descendants("svc_api").map((n) => n.id)).toEqual([
      "lyr_http",
      "mod_routes",
      "lyr_app",
      "mod_usecases",
      "lyr_domain",
      "mod_domain",
      "lyr_infra",
      "mod_repo",
    ]);
  });

  it("finds edges in both directions, optionally by kind", () => {
    const i = index();
    expect(i.outgoing("mod_repo").length).toBe(3);
    expect(i.outgoing("mod_repo", "accesses").map((e) => e.target)).toEqual(["dst_pg"]);
    expect(i.incoming("api_rest", "exposes").map((e) => e.source)).toEqual(["svc_api"]);
  });

  it("finds the enclosing service and layer", () => {
    const i = index();
    expect(i.serviceOf("mod_usecases")?.id).toBe("svc_api");
    expect(i.serviceOf("svc_api")?.id).toBe("svc_api");
    expect(i.serviceOf("api_rest")).toBeNull();
    expect(i.layerOf("mod_usecases")?.id).toBe("lyr_app");
    expect(i.layerOf("svc_api")).toBeNull();
  });

  it("resolves the stack for a node: nearest scope wins per category", () => {
    const i = index();
    expect(i.stackFor("mod_routes").map((s) => s.id)).toEqual([
      "stk_lang",
      "stk_api",
      "stk_db",
      "stk_orm",
      "stk_test",
    ]);
    expect(i.stackFor("mod_web_tasks").map((s) => s.id)).toContain("stk_web");
    expect(i.stackFor("mod_web_tasks").map((s) => s.id)).not.toContain("stk_api");

    const doc = parseDesign(teamTasksDesign);
    doc.stack.push({
      id: "stk_layer",
      category: "framework",
      name: "Hono",
      version: "",
      notes: "",
      scope: ["lyr_http"],
    });
    const frameworks = indexDesign(doc)
      .stackFor("mod_routes")
      .filter((s) => s.category === "framework");
    expect(frameworks.map((s) => s.id)).toEqual(["stk_layer"]);
  });

  it("collects conventions for a node and its ancestors", () => {
    const i = index();
    expect(i.conventionsFor("mod_routes").map((c) => c.id)).toEqual([
      "cnv_tests",
      "cnv_errors",
      "cnv_names",
    ]);
    expect(i.conventionsFor("mod_web_tasks").map((c) => c.id)).toEqual(["cnv_tests", "cnv_names"]);
  });

  it("finds nodes by case-insensitive name", () => {
    expect(
      index()
        .findByName("task USE cases")
        .map((n) => n.id),
    ).toEqual(["mod_usecases"]);
    expect(index().findByName("missing")).toEqual([]);
  });
});
