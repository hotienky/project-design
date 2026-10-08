import { describe, expect, it } from "vitest";

import { buildPlan } from "@/lib/design/build-plan";
import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { indexDesign } from "@/lib/design/graph";
import { parseDesign } from "@/lib/design/integrity";
import type { DesignDocumentInput } from "@/lib/design/schema";

const plan = (input: DesignDocumentInput = teamTasksDesign, statuses?: Map<string, never>) =>
  buildPlan(indexDesign(parseDesign(input)), statuses);

describe("buildPlan", () => {
  const steps = plan();
  const at = (id: string) => steps.findIndex((s) => s.id === id);

  it("starts with setup and numbers steps from 1", () => {
    expect(steps[0]).toMatchObject({ id: "setup", kind: "setup", order: 1 });
    expect(steps.map((s) => s.order)).toEqual(steps.map((_, i) => i + 1));
    expect(steps).toHaveLength(1 + 19); // all nodes except actor and note
  });

  it("orders data before contracts before services before their parts", () => {
    expect(at("dst_pg")).toBeLessThan(at("ent_task"));
    expect(at("ent_task")).toBeLessThan(at("api_rest"));
    expect(at("api_rest")).toBeLessThan(at("svc_api"));
    expect(at("svc_api")).toBeLessThan(at("mod_routes"));
    expect(at("lyr_domain")).toBeLessThan(at("lyr_app"));
    expect(at("lyr_app")).toBeLessThan(at("lyr_http"));
    expect(at("que_events")).toBeLessThan(at("mod_repo"));
    expect(at("int_email")).toBeLessThan(at("svc_notifier"));
  });

  it("never emits an actor or a note", () => {
    expect(at("act_member")).toBe(-1);
    expect(at("nte_scope")).toBe(-1);
  });

  it("lists direct prerequisites and points to get_component", () => {
    const step = steps[at("api_rest")]!;
    expect(step.dependsOn).toContain("ent_task");
    expect(step.instruction).toMatch(/Details: get_component\("api_rest"\)\.$/);
    expect(steps[at("dst_pg")]!.dependsOn).toEqual(["setup"]);
    expect(steps[0]!.instruction).toMatch(/get_project_brief\.$/);
  });

  it("attaches statuses", () => {
    const withStatus = plan(teamTasksDesign, new Map([["svc_api", "done"]]) as never);
    expect(withStatus.find((s) => s.id === "svc_api")?.status).toBe("done");
    expect(withStatus.find((s) => s.id === "svc_web")?.status).toBeNull();
  });

  it("breaks dependency cycles and marks the step", () => {
    const cyclic = plan({
      schemaVersion: 1,
      nodes: [
        { id: "a", kind: "service", name: "A" },
        { id: "b", kind: "service", name: "B" },
      ],
      edges: [
        { id: "e1", kind: "depends_on", source: "a", target: "b" },
        { id: "e2", kind: "depends_on", source: "b", target: "a" },
      ],
    });
    expect(cyclic.map((s) => s.id)).toEqual(["setup", "a", "b"]);
    expect(cyclic.filter((s) => s.cycle).map((s) => s.id)).toEqual(["a"]);
  });
});
