/**
 * Canvas geometry on the design document. Positions are stored relative to the
 * parent (React Flow's convention); these helpers convert and re-parent.
 */
import { canContain, NODE_KIND_META } from "@/lib/design/catalog";
import { sortNodesParentFirst } from "@/lib/design/integrity";
import type { DesignDocument, DesignNode } from "@/lib/design/schema";

export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Point {
  width: number;
  height: number;
}

export function nodeSize(n: DesignNode): { width: number; height: number } {
  return n.size ?? NODE_KIND_META[n.kind].defaultSize;
}

export function absolutePosition(doc: DesignDocument, id: string): Point {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  let x = 0;
  let y = 0;
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ <= doc.nodes.length) {
    x += cur.position.x;
    y += cur.position.y;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return { x, y };
}

export function absoluteRect(doc: DesignDocument, id: string): Rect {
  const n = doc.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`Unknown node ${id}`);
  return { ...absolutePosition(doc, id), ...nodeSize(n) };
}

/** The node and every node nested inside it. */
export function subtreeIds(doc: DesignDocument, id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of doc.nodes) {
      if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
        out.add(n.id);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * The smallest container of the right kind whose rect contains `center`, ignoring
 * `excluded` ids. Used for nodes that already exist (drag) and for nodes about to
 * be created (palette drop). null = top level, or no allowed container under the point.
 */
export function findContainerFor(
  doc: DesignDocument,
  kind: DesignNode["kind"],
  center: Point,
  excluded: ReadonlySet<string> = new Set(),
): string | null {
  let best: { id: string; area: number } | null = null;
  for (const c of doc.nodes) {
    if (excluded.has(c.id) || !NODE_KIND_META[c.kind].container) continue;
    if (!canContain(c.kind, kind)) continue;
    const r = absoluteRect(doc, c.id);
    const inside =
      center.x >= r.x && center.x <= r.x + r.width && center.y >= r.y && center.y <= r.y + r.height;
    if (inside && (!best || r.width * r.height < best.area)) {
      best = { id: c.id, area: r.width * r.height };
    }
  }
  return best?.id ?? null;
}

/**
 * The container a node dropped with its centre at `center` belongs in: the
 * smallest allowed container whose rect contains the point (never itself or a
 * descendant). null = top level, or no allowed container under the point.
 */
export function findDropParent(doc: DesignDocument, nodeId: string, center: Point): string | null {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return findContainerFor(doc, node.kind, center, subtreeIds(doc, nodeId));
}

/** Moves a node under a new parent (or to the top level) without moving it on screen. */
export function reparentNode(
  doc: DesignDocument,
  nodeId: string,
  newParentId: string | null,
): DesignDocument {
  const node = doc.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Unknown node ${nodeId}`);
  if (node.parentId === newParentId) return doc;
  const parent = newParentId ? doc.nodes.find((n) => n.id === newParentId) : null;
  if (newParentId && !parent) throw new Error(`Unknown parent ${newParentId}`);
  if (!canContain(parent?.kind ?? null, node.kind)) {
    throw new Error(
      `A ${node.kind} cannot be placed inside ${parent ? `a ${parent.kind}` : "the canvas"}`,
    );
  }
  if (newParentId && subtreeIds(doc, nodeId).has(newParentId)) {
    throw new Error("A node cannot be placed inside itself");
  }
  const abs = absolutePosition(doc, nodeId);
  const origin = newParentId ? absolutePosition(doc, newParentId) : { x: 0, y: 0 };
  const moved = {
    ...node,
    parentId: newParentId,
    position: { x: abs.x - origin.x, y: abs.y - origin.y },
  };
  return {
    ...doc,
    nodes: sortNodesParentFirst(doc.nodes.map((n) => (n.id === nodeId ? moved : n))),
  };
}

const PAD = 24;
const HEADER = 48;
const GAP = 40;

/**
 * Where a new node goes when nobody dragged it there: below its last sibling
 * inside a container, or to the right of everything at the top level.
 */
export function freePosition(doc: DesignDocument, parentId: string | null): Point {
  const siblings = doc.nodes.filter((n) => n.parentId === parentId);
  if (parentId === null) {
    const right = Math.max(0, ...siblings.map((n) => n.position.x + nodeSize(n).width + GAP));
    return { x: siblings.length ? right : 0, y: 0 };
  }
  const bottom = Math.max(
    HEADER,
    ...siblings.map((n) => n.position.y + nodeSize(n).height + PAD / 2),
  );
  return { x: PAD, y: bottom };
}

/** Grows a container (and its ancestors) so every child fits inside it. */
export function growToFit(doc: DesignDocument, containerId: string | null): DesignDocument {
  let next = doc;
  let id = containerId;
  while (id !== null) {
    const container = next.nodes.find((n) => n.id === id);
    if (!container) break;
    const size = nodeSize(container);
    let width = size.width;
    let height = size.height;
    for (const c of next.nodes) {
      if (c.parentId !== id) continue;
      const s = nodeSize(c);
      width = Math.max(width, c.position.x + s.width + PAD);
      height = Math.max(height, c.position.y + s.height + PAD);
    }
    if (width !== size.width || height !== size.height) {
      next = {
        ...next,
        nodes: next.nodes.map((n) => (n.id === id ? { ...n, size: { width, height } } : n)),
      };
    }
    id = container.parentId;
  }
  return next;
}
