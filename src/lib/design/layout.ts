/**
 * Automatic layout: siblings are arranged as a left-to-right tree (mind-map style) that follows
 * the edges between them, so connected components fan out from their sources and nothing
 * overlaps. Pure; the canvas applies the result as one undo step.
 */
import { NODE_KIND_META } from "@/lib/design/catalog";
import {
  CONTAINER_HEADER,
  CONTAINER_PAD,
  nodeSize,
  summarySize,
  type Point,
} from "@/lib/design/geometry";
import type { DesignDocument, DesignNode } from "@/lib/design/schema";

export interface LayoutBox {
  id: string;
  width: number;
  height: number;
}

/** Room between columns for edge pills, and between stacked cards (status chips render taller). */
const GAP = { x: 144, y: 40 };
const SNAP = 8;

const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/**
 * Top-left positions for `boxes`, laid out as a forest along `links` (source → target pairs).
 * Each linked box hangs off the first box that reaches it; a parent is centred on its subtree,
 * columns are as wide as their widest box. Unlinked boxes form a grid below the trees.
 */
export function treePositions(boxes: LayoutBox[], links: [string, string][]): Map<string, Point> {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const out = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const linked = new Set<string>();
  const seen = new Set<string>();
  for (const [s, t] of links) {
    const key = `${s}\u0000${t}`;
    if (s === t || !byId.has(s) || !byId.has(t) || seen.has(key)) continue;
    seen.add(key);
    out.set(s, [...(out.get(s) ?? []), t]);
    indegree.set(t, (indegree.get(t) ?? 0) + 1);
    linked.add(s).add(t);
  }

  // Spanning forest, breadth first: a box's tree parent is the first box that reaches it.
  const children = new Map<string, string[]>();
  const depth = new Map<string, number>();
  const roots: string[] = [];
  const grow = (root: string) => {
    roots.push(root);
    depth.set(root, 0);
    const queue = [root];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const next of out.get(id) ?? []) {
        if (depth.has(next)) continue;
        depth.set(next, depth.get(id)! + 1);
        children.set(id, [...(children.get(id) ?? []), next]);
        queue.push(next);
      }
    }
  };
  for (const b of boxes) if (linked.has(b.id) && !indegree.get(b.id)) grow(b.id);
  // Whatever is left sits on a cycle that no source reaches: start from its first box.
  for (const b of boxes) if (linked.has(b.id) && !depth.has(b.id)) grow(b.id);

  const columnWidth: number[] = [];
  for (const [id, d] of depth) columnWidth[d] = Math.max(columnWidth[d] ?? 0, byId.get(id)!.width);
  const columnX: number[] = [];
  columnWidth.forEach(
    (w, d) => (columnX[d] = d === 0 ? 0 : columnX[d - 1]! + columnWidth[d - 1]! + GAP.x),
  );

  const span = new Map<string, number>();
  const spanOf = (id: string): number => {
    const kids = children.get(id) ?? [];
    const stacked = kids.reduce((t, k) => t + spanOf(k), 0) + Math.max(0, kids.length - 1) * GAP.y;
    const h = Math.max(byId.get(id)!.height, stacked);
    span.set(id, h);
    return h;
  };

  const positions = new Map<string, Point>();
  const place = (id: string, top: number) => {
    const box = byId.get(id)!;
    const h = span.get(id)!;
    positions.set(id, { x: snap(columnX[depth.get(id)!]!), y: snap(top + (h - box.height) / 2) });
    const kids = children.get(id) ?? [];
    const stacked =
      kids.reduce((t, k) => t + span.get(k)!, 0) + Math.max(0, kids.length - 1) * GAP.y;
    let y = top + (h - stacked) / 2;
    for (const k of kids) {
      place(k, y);
      y += span.get(k)! + GAP.y;
    }
  };
  let top = 0;
  for (const root of roots) {
    const h = spanOf(root);
    place(root, top);
    top += h + GAP.y * 2;
  }

  // Unlinked boxes: a roughly square grid of uniform cells under the trees.
  const loose = boxes.filter((b) => !linked.has(b.id));
  if (loose.length > 0) {
    const cols = Math.ceil(Math.sqrt(loose.length));
    const cell = Math.max(...loose.map((b) => b.width)) + GAP.y * 2;
    for (let row = 0; row * cols < loose.length; row++) {
      const items = loose.slice(row * cols, (row + 1) * cols);
      items.forEach((b, i) => positions.set(b.id, { x: snap(i * cell), y: snap(top) }));
      top += Math.max(...items.map((b) => b.height)) + GAP.y;
    }
  }
  return positions;
}

/**
 * Arranges what the canvas shows. `rootId` null lays out the top level, otherwise the inside of
 * that container. Unless `collapsed`, every container below is laid out first (deepest first) and
 * resized to fit its children, so the parent level sees final sizes. `collapsed` (the levels view's
 * project level) arranges top-level nodes only, sizing containers as summary cards.
 */
export function arrangeLayout(
  doc: DesignDocument,
  rootId: string | null,
  { collapsed = false }: { collapsed?: boolean } = {},
): DesignDocument {
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

  const arrange = (parentId: string | null) => {
    // doc.nodes order keeps the result stable for the same document.
    const kids = doc.nodes.filter((n) => n.parentId === parentId).map((n) => nodes.get(n.id)!);
    if (kids.length === 0) return;
    const links = doc.edges
      .map((e): [string | null, string | null] => [
        lift(e.source, parentId),
        lift(e.target, parentId),
      ])
      .filter((l): l is [string, string] => l[0] !== null && l[1] !== null);
    const positions = treePositions(
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
      if (NODE_KIND_META[n.kind].container && inScope(n)) arrange(n.id);
    }
  }
  arrange(rootId);

  // A container that grew pushes the siblings below and to the right of it out of the way, then
  // its parent grows to fit, and so on up: tidying one level never makes it overlap a neighbour.
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
