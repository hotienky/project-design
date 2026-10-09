import { describe, expect, it } from "vitest";

import { NODE_KIND_META } from "@/lib/design/catalog";
import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { nodeSize, summarySize, type Rect } from "@/lib/design/geometry";
import { parseDesign } from "@/lib/design/integrity";
import { arrangeLayout, treePositions } from "@/lib/design/layout";
import type { DesignDocument } from "@/lib/design/schema";

const doc = () => parseDesign(teamTasksDesign);

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Sibling rects (relative to their parent) that overlap, as "a/b" pairs. */
function collisions(d: DesignDocument, collapsed = false): string[] {
  const out: string[] = [];
  const rect = (id: string): Rect => {
    const n = d.nodes.find((x) => x.id === id)!;
    const size = collapsed && NODE_KIND_META[n.kind].container ? summarySize() : nodeSize(n);
    return { ...n.position, ...size };
  };
  for (const a of d.nodes)
    for (const b of d.nodes)
      if (a.id < b.id && a.parentId === b.parentId && (!collapsed || a.parentId === null))
        if (overlaps(rect(a.id), rect(b.id))) out.push(`${a.id}/${b.id}`);
  return out;
}

describe("treePositions", () => {
  const box = (id: string) => ({ id, width: 200, height: 50 });

  it("fans targets out to the right of their source, centred on it", () => {
    const p = treePositions(
      [box("a"), box("b"), box("c")],
      [
        ["a", "b"],
        ["a", "c"],
      ],
    );
    expect(p.get("a")!.x).toBe(0);
    expect(p.get("b")!.x).toBeGreaterThan(200);
    expect(p.get("c")!.x).toBe(p.get("b")!.x);
    expect(p.get("c")!.y).toBeGreaterThan(p.get("b")!.y + 50);
    // The source sits midway between its children.
    expect(Math.abs(p.get("a")!.y - (p.get("b")!.y + p.get("c")!.y) / 2)).toBeLessThanOrEqual(8);
  });

  it("follows chains into columns and survives cycles and duplicate links", () => {
    const p = treePositions(
      [box("a"), box("b"), box("c")],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
        ["a", "b"],
      ],
    );
    const xs = ["a", "b", "c"].map((id) => p.get(id)!.x);
    expect(new Set(xs).size).toBe(3);
    expect(xs).toEqual([...xs].sort((x, y) => x - y));
  });

  it("puts unlinked boxes in a grid instead of a single row", () => {
    const boxes = Array.from({ length: 16 }, (_, i) => box(`n${i}`));
    const p = treePositions(boxes, []);
    expect(new Set([...p.values()].map((q) => q.x)).size).toBe(4);
    expect(new Set([...p.values()].map((q) => q.y)).size).toBe(4);
  });
});

describe("arrangeLayout", () => {
  it("lays out the whole design with no overlapping siblings", () => {
    const before = doc();
    const after = arrangeLayout(before, null);
    expect(collisions(after)).toEqual([]);
    expect(parseDesign(after)).toEqual(after);
    // Containers are sized to fit what is inside them.
    for (const c of after.nodes.filter((n) => NODE_KIND_META[n.kind].container)) {
      for (const k of after.nodes.filter((n) => n.parentId === c.id)) {
        expect(k.position.x + nodeSize(k).width).toBeLessThanOrEqual(nodeSize(c).width);
        expect(k.position.y + nodeSize(k).height).toBeLessThanOrEqual(nodeSize(c).height);
      }
    }
  });

  it("unrolls a single row of connected top-level components into a tree", () => {
    const base = doc();
    // What freePosition produces for an agent-built design: everything in one row.
    let x = 0;
    const row = {
      ...base,
      nodes: base.nodes.map((n) => {
        if (n.parentId !== null) return n;
        const moved = { ...n, position: { x, y: 0 } };
        x += nodeSize(n).width + 40;
        return moved;
      }),
    };
    const after = arrangeLayout(row, null, { collapsed: true });
    expect(collisions(after, true)).toEqual([]);
    const top = after.nodes.filter((n) => n.parentId === null);
    expect(new Set(top.map((n) => n.position.y)).size).toBeGreaterThan(1);
    // Collapsed: nothing inside a container moves.
    for (const n of after.nodes.filter((m) => m.parentId !== null))
      expect(n).toBe(row.nodes.find((m) => m.id === n.id));
  });

  it("arranges only inside a container and grows its ancestors to fit", () => {
    const before = doc();
    const after = arrangeLayout(before, "lyr_app");
    expect(collisions(after)).toEqual([]);
    const outside = (id: string) => after.nodes.find((n) => n.id === id);
    expect(outside("svc_web")).toBe(before.nodes.find((n) => n.id === "svc_web"));
    const layer = outside("lyr_app")!;
    const service = outside("svc_api")!;
    expect(layer.position.y + nodeSize(layer).height).toBeLessThanOrEqual(nodeSize(service).height);
  });
});
