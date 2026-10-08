import { describe, expect, it } from "vitest";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import {
  absolutePosition,
  findDropParent,
  freePosition,
  growToFit,
  nodeSize,
  reparentNode,
} from "@/lib/design/geometry";
import { parseDesign } from "@/lib/design/integrity";

const doc = () => parseDesign(teamTasksDesign);

describe("geometry", () => {
  it("sums positions up the parent chain", () => {
    // svc_api (420,0) → lyr_app (20,160) → mod_usecases (20,20)
    expect(absolutePosition(doc(), "mod_usecases")).toEqual({ x: 460, y: 180 });
  });

  it("picks the smallest allowed container under the point", () => {
    const d = doc();
    // Inside lyr_domain (abs 440,280 480×100) which is inside svc_api.
    expect(findDropParent(d, "mod_usecases", { x: 500, y: 320 })).toBe("lyr_domain");
    // Inside svc_api but between layers → the service itself.
    expect(findDropParent(d, "mod_usecases", { x: 430, y: 10 })).toBe("svc_api");
    // Entities dropped on a datastore become part of its schema.
    expect(findDropParent(d, "ent_task", { x: 1100, y: 100 })).toBe("dst_pg");
    // Nowhere special.
    expect(findDropParent(d, "mod_usecases", { x: -900, y: -900 })).toBeNull();
    // A layer can never be dropped into a datastore.
    expect(findDropParent(d, "lyr_app", { x: 1100, y: 100 })).toBeNull();
  });

  it("reparents without moving the node on screen", () => {
    const before = doc();
    const abs = absolutePosition(before, "mod_usecases");
    const after = reparentNode(before, "mod_usecases", "lyr_domain");
    expect(after.nodes.find((n) => n.id === "mod_usecases")?.parentId).toBe("lyr_domain");
    expect(absolutePosition(after, "mod_usecases")).toEqual(abs);
    const top = reparentNode(after, "mod_usecases", "svc_api");
    expect(absolutePosition(top, "mod_usecases")).toEqual(abs);
  });

  it("refuses illegal parents and cycles", () => {
    const d = doc();
    expect(() => reparentNode(d, "lyr_app", null)).toThrow(/cannot be placed/);
    expect(() => reparentNode(d, "svc_api", "lyr_app")).toThrow();
  });

  it("places new nodes below their siblings and grows containers to fit", () => {
    const d = doc();
    const pos = freePosition(d, "lyr_app");
    const siblings = d.nodes.filter((n) => n.parentId === "lyr_app");
    for (const n of siblings)
      expect(pos.y).toBeGreaterThanOrEqual(n.position.y + nodeSize(n).height);
    const top = freePosition(d, null);
    expect(top.y).toBe(0);
    expect(top.x).toBeGreaterThan(0);

    const moved = {
      ...d,
      nodes: d.nodes.map((n) =>
        n.id === "mod_usecases" ? { ...n, position: { x: 20, y: 900 } } : n,
      ),
    };
    const grown = growToFit(moved, "lyr_app");
    const layer = grown.nodes.find((n) => n.id === "lyr_app")!;
    const service = grown.nodes.find((n) => n.id === "svc_api")!;
    expect(nodeSize(layer).height).toBeGreaterThan(900);
    expect(nodeSize(service).height).toBeGreaterThan(layer.position.y + nodeSize(layer).height);
  });
});
