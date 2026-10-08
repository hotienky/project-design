import { describe, expect, it } from "vitest";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { parseDesign } from "@/lib/design/integrity";
import type { DesignDocumentInput } from "@/lib/design/schema";
import { validateDesign } from "@/lib/design/validate";

type Input = Partial<DesignDocumentInput>;
const build = (input: Input) => parseDesign({ schemaVersion: 1, ...input });
const codes = (input: Input) => validateDesign(build(input)).map((i) => i.code);

const svc = (id: string, data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  ({ id, kind: "service", name: id, description: "d", data, ...extra }) as never;
const withLang = { stack: [{ id: "stk_l", category: "language", name: "TS" }] } as Input;

describe("validateDesign", () => {
  it("finds no errors or warnings in the example", () => {
    const issues = validateDesign(parseDesign(teamTasksDesign));
    expect(issues.filter((i) => i.severity !== "info")).toEqual([]);
  });

  it("warns when siblings overlap on the canvas", () => {
    const doc = parseDesign(teamTasksDesign);
    const project = doc.nodes.find((n) => n.id === "ent_project")!;
    project.position = { x: 20, y: 100 }; // User (y 40) is 130 tall
    const overlaps = validateDesign(doc).filter((i) => i.code === "layout.overlap");
    expect(overlaps).toEqual([
      expect.objectContaining({ severity: "warning", nodeId: "ent_project" }),
    ]);
    // The same coordinates in different containers are different places.
    expect(
      validateDesign(parseDesign(teamTasksDesign)).some((i) => i.code === "layout.overlap"),
    ).toBe(false);
  });

  it("measures top-level containers as summary cards in the levels layout", () => {
    const doc = parseDesign(teamTasksDesign);
    const api = doc.nodes.find((n) => n.id === "api_rest")!;
    api.position = { x: 420, y: 200 }; // inside the 520×520 API service, below its card
    const overlaps = (layout: "all" | "levels") =>
      validateDesign(doc, { layout }).filter((i) => i.code === "layout.overlap");
    expect(overlaps("all")).toEqual([expect.objectContaining({ nodeId: "api_rest" })]);
    expect(overlaps("levels")).toEqual([]);
  });

  it("sorts errors, then warnings, then info", () => {
    const doc = parseDesign(teamTasksDesign);
    const ent = doc.nodes.find((n) => n.id === "ent_task")!;
    const extra = (id: string, patch: object) => ({ ...ent, id, name: id, ...patch }) as never;
    doc.nodes.push(extra("ent_empty", { data: { fields: [], indexes: [] } })); // warning
    doc.nodes.push(extra("ent_orphan", { parentId: "missing" })); // error
    doc.nodes.push({
      ...ent,
      id: "lyr_x",
      kind: "layer",
      name: "X",
      parentId: "svc_api",
      data: {},
    } as never); // info
    const severities = validateDesign(doc).map((i) => i.severity);
    expect(severities).toEqual(
      [...severities].sort((a, b) => "ewi".indexOf(a[0]!) - "ewi".indexOf(b[0]!)),
    );
    expect(new Set(severities)).toEqual(new Set(["error", "warning", "info"]));
  });

  it("design.empty and overview.no_summary", () => {
    expect(codes({})).toEqual(expect.arrayContaining(["design.empty", "overview.no_summary"]));
  });

  it("stack.no_language", () => {
    expect(codes({ nodes: [svc("s1")] })).toContain("stack.no_language");
    expect(codes({ ...withLang, nodes: [svc("s1")] })).not.toContain("stack.no_language");
    expect(codes({ nodes: [svc("s1", { language: "Go" })] })).not.toContain("stack.no_language");
  });

  it("service.no_path and service.duplicate_path", () => {
    expect(codes({ ...withLang, nodes: [svc("a"), svc("b", { path: "x" })] })).toContain(
      "service.no_path",
    );
    expect(codes({ ...withLang, nodes: [svc("a")] })).not.toContain("service.no_path");
    expect(
      codes({ ...withLang, nodes: [svc("a", { path: "x" }), svc("b", { path: "x" })] }),
    ).toContain("service.duplicate_path");
  });

  it("env.duplicate", () => {
    const env = [{ name: "A" }, { name: "A" }];
    expect(codes({ ...withLang, nodes: [svc("a", { env })] })).toContain("env.duplicate");
  });

  it("node.duplicate_name", () => {
    const nodes = [svc("a", {}, { name: "Same" }), svc("b", {}, { name: "same" })];
    expect(codes({ ...withLang, nodes })).toContain("node.duplicate_name");
  });

  it("node.no_description", () => {
    const nodes = [{ id: "s", kind: "service", name: "S", data: {} }] as never;
    expect(codes({ ...withLang, nodes })).toContain("node.no_description");
    expect(codes({ ...withLang, nodes: [svc("s")] })).not.toContain("node.no_description");
  });

  const layered = (edges: unknown[], extraLayerEdges: unknown[] = []) =>
    ({
      ...withLang,
      nodes: [
        svc("s"),
        { id: "l1", kind: "layer", name: "A", parentId: "s", description: "d" },
        { id: "l2", kind: "layer", name: "B", parentId: "s", description: "d" },
        { id: "m1", kind: "module", name: "M1", parentId: "l1", description: "d" },
        { id: "m2", kind: "module", name: "M2", parentId: "l2", description: "d" },
      ],
      edges: [...edges, ...extraLayerEdges],
    }) as Input;

  it("layer.empty", () => {
    const nodes = [
      svc("s"),
      { id: "l", kind: "layer", name: "L", parentId: "s", description: "d" },
    ] as never;
    expect(codes({ ...withLang, nodes })).toContain("layer.empty");
  });

  it("layer.dependency_violation", () => {
    const edge = { id: "e1", kind: "depends_on", source: "m1", target: "m2" };
    const issues = validateDesign(build(layered([edge])));
    const violation = issues.find((i) => i.code === "layer.dependency_violation");
    expect(violation?.message).toBe("M1 (A) depends on M2 (B), but A has no depends_on to B");
    const allowed = { id: "e2", kind: "depends_on", source: "l1", target: "l2" };
    expect(codes(layered([edge], [allowed]))).not.toContain("layer.dependency_violation");
  });

  it("dependency.cycle", () => {
    const edges = [
      { id: "e1", kind: "depends_on", source: "s1", target: "s2" },
      { id: "e2", kind: "depends_on", source: "s2", target: "s1" },
    ] as never;
    const issues = validateDesign(build({ ...withLang, nodes: [svc("s1"), svc("s2")], edges }));
    const cycles = issues.filter((i) => i.code === "dependency.cycle");
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.message).toBe("Circular dependency: s1 → s2 → s1");
  });

  const api = (data: Record<string, unknown>) =>
    ({ id: "a", kind: "api", name: "A", description: "d", data }) as never;

  it("api rules", () => {
    expect(codes({ nodes: [api({})] })).toEqual(
      expect.arrayContaining(["api.no_implementer", "api.no_operations"]),
    );
    const incomplete = api({ operations: [{ id: "o1", name: "x" }] });
    expect(codes({ nodes: [incomplete] })).toContain("api.rest_incomplete");
    const dup = api({
      operations: [
        { id: "o1", name: "a", method: "GET", path: "/x" },
        { id: "o2", name: "b", method: "GET", path: "/x" },
      ],
    });
    expect(codes({ nodes: [dup] })).toContain("api.duplicate_route");
    const ok = api({ operations: [{ id: "o1", name: "a", method: "GET", path: "/x" }] });
    expect(codes({ nodes: [ok] })).not.toContain("api.duplicate_route");
  });

  it("entity rules", () => {
    const ent = (id: string, extra: Record<string, unknown>, fields: unknown[]) =>
      ({ id, kind: "entity", name: id, description: "d", data: { fields }, ...extra }) as never;
    const store = { id: "d", kind: "datastore", name: "D", description: "d" } as never;
    expect(codes({ nodes: [ent("e", {}, [])] })).toContain("entity.no_fields");
    const noPk = ent("e", { parentId: "d" }, [{ name: "a", type: "string" }]);
    expect(codes({ nodes: [store, noPk] })).toContain("entity.no_primary_key");
    const domain = ent("e", {}, [{ name: "a", type: "string" }]);
    expect(codes({ nodes: [domain] })).not.toContain("entity.no_primary_key");
  });

  it("relation.fk_missing", () => {
    const ent = (id: string) =>
      ({
        id,
        kind: "entity",
        name: id,
        description: "d",
        data: { fields: [{ name: "id", type: "uuid", primary: true }] },
      }) as never;
    const edges = [
      { id: "r", kind: "relation", source: "a", target: "b", data: { foreignKey: "aId" } },
    ] as never;
    expect(codes({ nodes: [ent("a"), ent("b")], edges })).toContain("relation.fk_missing");
  });

  it("datastore.unused and integration.unused", () => {
    const nodes = [
      { id: "d", kind: "datastore", name: "D", description: "d" },
      { id: "i", kind: "integration", name: "I", description: "d" },
    ] as never;
    expect(codes({ nodes })).toEqual(
      expect.arrayContaining(["datastore.unused", "integration.unused"]),
    );
  });

  it("queue rules", () => {
    const queue = (channels: unknown[]) =>
      ({ id: "q", kind: "queue", name: "Q", description: "d", data: { channels } }) as never;
    expect(codes({ nodes: [queue([])] })).toEqual(
      expect.arrayContaining(["queue.no_channels", "queue.no_producer", "queue.no_consumer"]),
    );
    const channels = [
      { id: "c1", name: "one" },
      { id: "c2", name: "two" },
    ];
    const edges = [
      { id: "p1", kind: "publishes", source: "s", target: "q", data: { channelId: "c1" } },
      { id: "p2", kind: "subscribes", source: "s", target: "q", data: { channelId: null } },
    ] as never;
    const issues = validateDesign(
      build({ ...withLang, nodes: [svc("s"), queue(channels)], edges }),
    );
    const messages = issues.map((i) => `${i.code}:${i.message}`);
    expect(messages).toContain('queue.no_producer:Channel "two" of queue "Q" has no producer.');
    expect(issues.map((i) => i.code)).not.toContain("queue.no_consumer");
    expect(issues.find((i) => i.code === "edge.channel_unset")?.severity).toBe("info");
  });
});
