/**
 * Flow-aware automatic layout with elkjs (layered, left-to-right).
 *
 * Same contract as `layout.ts` but positions come from ELK instead of the
 * hand-rolled `treePositions` BFS tree, so connected components follow the
 * dependency flow and edge crossings are minimized.
 *
 * Pure and isomorphic (no React/Next/node imports) so the canvas, tests and
 * the MCP server can all use it. ELK is loaded lazily so the initial client
 * bundle stays light; the first Tidy click pays ~600KB once.
 */
import { NODE_KIND_META } from "@/lib/design/catalog";
import {
  CONTAINER_HEADER,
  CONTAINER_PAD,
  nodeSize,
  summarySize,
  type Point,
} from "@/lib/design/geometry";
import type { DesignDocument, DesignEdge, DesignNode, EdgeKind } from "@/lib/design/schema";
import type { LayoutBox } from "@/lib/design/layout";

/** How strongly an edge pulls its endpoints into the same flow lane. */
export const LAYOUT_EDGE_WEIGHT: Record<EdgeKind, number> = {
  depends_on: 10,
  calls: 10,
  exposes: 10,
  publishes: 8,
  subscribes: 8,
  accesses: 5,
  uses: 5,
  interacts: 5,
  relation: 5,
  drives: 10,
  produces: 8,
  consumes: 8,
  triggers: 8,
  modifies: 5,
};

/**
 * Direction an edge points in the layout (source → target pairs).
 * `subscribes` is reversed: data flows queue → subscriber, so the queue
 * sits left and the subscriber right. Every other kind keeps its direction.
 */
export function layoutLinkFor(edge: DesignEdge): [string, string] {
  if (edge.kind === "subscribes") return [edge.target, edge.source];
  return [edge.source, edge.target];
}

const SNAP = 8;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

// Lazy singleton: one ELK instance per process, created on first use.
let elkInstance: { layout: (g: unknown) => Promise<unknown> } | null = null;
async function getElk(): Promise<{ layout: (g: unknown) => Promise<unknown> }> {
  if (elkInstance) return elkInstance;
  const mod = (await import("elkjs/lib/elk.bundled.js")) as unknown as {
    default: new () => { layout: (g: unknown) => Promise<unknown> };
  };
  elkInstance = new mod.default();
  return elkInstance;
}

/**
 * Top-left positions for `boxes` along `links` (source → target pairs).
 * Drop-in async replacement for `treePositions`: same input order in,
 * deterministic positions out, no overlaps.
 */
export async function elkPositions(
  boxes: LayoutBox[],
  links: [string, string][],
): Promise<Map<string, Point>> {
  const positions = new Map<string, Point>();
  if (boxes.length === 0) return positions;
  if (boxes.length === 1) {
    positions.set(boxes[0]!.id, { x: 0, y: 0 });
    return positions;
  }

  const byId = new Map(boxes.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const edges: { id: string; sources: string[]; targets: string[] }[] = [];
  let n = 0;
  for (const [s, t] of links) {
    const key = s + "::" + t;
    if (s === t || !byId.has(s) || !byId.has(t) || seen.has(key)) continue;
    seen.add(key);
    edges.push({ id: "e" + n++, sources: [s], targets: [t] });
  }

  const elk = await getElk();
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.padding": "[0,0,0,0]",
      "elk.spacing.nodeNode": "40",
      "elk.layered.spacing.nodeNodeBetweenLayers": "144",
      "elk.layered.spacing.edgeNodeBetweenLayers": "40",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_CHOICE",
    },
    children: boxes.map((b) => ({ id: b.id, width: b.width, height: b.height })),
    edges,
  };

  const laid = (await elk.layout(graph)) as {
    children?: { id: string; x?: number; y?: number }[];
  };
  for (const c of laid.children ?? []) {
    positions.set(c.id, { x: snap(c.x ?? 0), y: snap(c.y ?? 0) });
  }
  // ELK always returns every child; fall back to origin for safety.
  for (const b of boxes) {
    if (!positions.has(b.id)) positions.set(b.id, { x: 0, y: 0 });
  }
  return positions;
}

/**
 * Async ELK version of `arrangeLayout`: lays out the inside of `rootId`
 * (null = top level) along the flow, deepest containers first, resizing
 * containers to fit. One call = one undo step on the canvas.
 */
export async function arrangeLayoutElk(
  doc: DesignDocument,
  rootId: string | null,
  { collapsed = false }: { collapsed?: boolean } = {},
): Promise<DesignDocument> {
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  const sizeOf = (n: DesignNode) =>
    collapsed && NODE_KIND_META[n.kind].container ? summarySize() : nodeSize(n);

  /** The ancestor of `id` (or itself) that sits directly in `parentId`. */
  const lift = (id: string, parentId: string | null): string | null => {
    let n = nodes.get(id);
    let guard = 0;
    while (n && n.parentId !== parentId && guard++ <= nodes.size)
      n = n.parentId ? nodes.get(n.parentId) : undefined;
    return n && n.parentId === parentId ? n.id : null;
  };

  const arrange = async (parentId: string | null) => {
    const kids = doc.nodes.filter((n) => n.parentId === parentId).map((n) => nodes.get(n.id)!);
    if (kids.length === 0) return;
    const links = doc.edges
      .map((e): [string | null, string | null] => {
        const [s, t] = layoutLinkFor(e);
        return [lift(s, parentId), lift(t, parentId)];
      })
      .filter((l): l is [string, string] => l[0] !== null && l[1] !== null);
    const positions = await elkPositions(
      kids.map((n) => ({ id: n.id, ...sizeOf(n) })),
      links,
    );
    const inset = parentId ? { x: CONTAINER_PAD, y: CONTAINER_HEADER } : { x: 0, y: 0 };
    let right = 0;
    let bottom = 0;
    for (const n of kids) {
      const p = positions.get(n.id)!;
      const position = { x: p.x + inset.x, y: p.y + inset.y };
      nodes.set(n.id, { ...n, position });
      right = Math.max(right, position.x + sizeOf(n).width);
      bottom = Math.max(bottom, position.y + sizeOf(n).height);
    }
    if (parentId) {
      const parent = nodes.get(parentId)!;
      nodes.set(parentId, {
        ...parent,
        size: { width: right + CONTAINER_PAD, height: bottom + CONTAINER_PAD },
      });
    }
  };

  if (!collapsed) {
    const inScope = (n: DesignNode) => rootId === null || lift(n.id, rootId) !== null;
    // Parents-first storage reversed: every container is arranged after the ones inside it.
    for (const n of [...doc.nodes].reverse()) {
      if (NODE_KIND_META[n.kind].container && inScope(n)) {
        // Sequential: parents need final child sizes.
        await arrange(n.id);
      }
    }
  }
  await arrange(rootId);

  // Same push-aside + grow logic as arrangeLayout: tidying one level never
  // makes it overlap a neighbour.
  let id = rootId;
  while (id) {
    const n = nodes.get(id)!;
    const before = nodeSize(doc.nodes.find((m) => m.id === id)!);
    const after = nodeSize(n);
    const dx = Math.max(0, after.width - before.width);
    const dy = Math.max(0, after.height - before.height);
    for (const s of nodes.values()) {
      if (s.parentId !== n.parentId || s.id === n.id) continue;
      const x = s.position.x >= n.position.x + before.width ? dx : 0;
      const y = s.position.y >= n.position.y + before.height ? dy : 0;
      if (x || y) nodes.set(s.id, { ...s, position: { x: s.position.x + x, y: s.position.y + y } });
    }
    if (!n.parentId) break;
    const parent = nodes.get(n.parentId)!;
    const size = nodeSize(parent);
    let width = size.width;
    let height = size.height;
    for (const k of nodes.values()) {
      if (k.parentId !== parent.id) continue;
      width = Math.max(width, k.position.x + nodeSize(k).width + CONTAINER_PAD);
      height = Math.max(height, k.position.y + nodeSize(k).height + CONTAINER_PAD);
    }
    nodes.set(parent.id, { ...parent, size: { width, height } });
    id = parent.id;
  }

  return { ...doc, nodes: doc.nodes.map((n) => nodes.get(n.id)!) };
}

const rectsOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Whether a document looks like it was never arranged: siblings overlap, or
 * every top-level node sits on one row (what `freePosition` produces for
 * agent-built designs). The canvas auto-arranges once on open when this is
 * true, so untidy designs follow the flow without any button.
 */
export function needsAutoLayout(doc: DesignDocument): boolean {
  if (doc.nodes.length === 0) return false;
  const rectOf = (n: DesignNode) => ({ ...n.position, ...nodeSize(n) });
  const byParent = new Map<string | null, DesignNode[]>();
  for (const n of doc.nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  for (const siblings of byParent.values()) {
    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        if (rectsOverlap(rectOf(siblings[i]!), rectOf(siblings[j]!))) return true;
      }
    }
  }
  const top = byParent.get(null) ?? [];
  if (top.length >= 3 && top.every((n) => n.position.y === top[0]!.position.y)) return true;
  return false;
}
