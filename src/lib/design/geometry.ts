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

export interface CardMetric {
  key:
    | "responsibilities"
    | "env"
    | "rules"
    | "exports"
    | "goals"
    | "patterns"
    | "tags"
    | "parameters"
    | "steps"
    | "rows";
  value: number;
  label: string;
}

/** Counts a card shows as chips, per kind. Zero counts, and counts the subtitle already shows, are left out. */
export function cardMetrics(n: DesignNode): CardMetric[] {
  const own: CardMetric[] = [];
  switch (n.kind) {
    case "service":
      own.push(
        {
          key: "responsibilities",
          value: n.data.responsibilities.length,
          label: "responsibilities",
        },
        { key: "env", value: n.data.env.length, label: "environment variables" },
      );
      break;
    case "layer":
      own.push(
        {
          key: "responsibilities",
          value: n.data.responsibilities.length,
          label: "responsibilities",
        },
        { key: "rules", value: n.data.rules.length, label: "rules" },
      );
      break;
    case "module":
      if (n.data.responsibilities.length > 0)
        own.push({ key: "exports", value: n.data.exports.length, label: "exports" });
      break;
    case "integration":
      own.push({ key: "env", value: n.data.env.length, label: "environment variables" });
      break;
    case "actor":
      own.push({ key: "goals", value: n.data.goals.length, label: "goals" });
      break;
    case "loop":
      own.push({ key: "steps", value: n.data.steps.length, label: "steps" });
      break;
    case "system":
    case "mechanic":
      own.push(
        { key: "rules", value: n.data.rules.length, label: "rules" },
        {
          key: "parameters",
          value: n.data.parameters.length + n.data.formulas.length,
          label: "parameters and formulas",
        },
      );
      break;
    case "content":
      own.push({ key: "rows", value: n.data.rows.length, label: "rows" });
      break;
  }
  own.push(
    { key: "patterns", value: n.patterns.length, label: "patterns" },
    { key: "tags", value: n.tags.length, label: "tags" },
  );
  return own.filter((m) => m.value > 0);
}

/** An entity card lists at most this many fields, then a "+N more" row. */
export const ENTITY_FIELD_ROWS = 6;

/**
 * Rendered card geometry (base-node.tsx), in canvas pixels. Leaf cards size to their
 * content, so layout code needs the same numbers to keep siblings from overlapping.
 */
const CARD = {
  width: 208,
  /** Border, padding and the two-line title. */
  base: 54,
  /** Metric/status chip row with its top margin. */
  chips: 26,
  /** Field list chrome: top margin, border and vertical padding. */
  fieldList: 22,
  fieldRow: 16.5,
  fieldGap: 2,
};

/**
 * A node's footprint on the canvas: the stored size for containers (and anything
 * resized), otherwise the size its card renders at. The agent-reported status chip
 * is not part of the document, so a card that shows only that chip renders one
 * chip row taller than this.
 */
export function nodeSize(n: DesignNode): { width: number; height: number } {
  if (n.size) return n.size;
  const meta = NODE_KIND_META[n.kind];
  if (meta.container || n.kind === "note") return meta.defaultSize;
  let height = CARD.base;
  if (n.kind === "entity" && n.data.fields.length > 0) {
    const rows = Math.min(n.data.fields.length, ENTITY_FIELD_ROWS + 1);
    height += CARD.fieldList + rows * CARD.fieldRow + (rows - 1) * CARD.fieldGap;
  }
  if (cardMetrics(n).length > 0) height += CARD.chips;
  return { width: CARD.width, height: Math.ceil(height) };
}

/** A container collapsed to a levels-view summary card: title plus the "N inside" chip row. */
export function summarySize(): { width: number; height: number } {
  return { width: CARD.width, height: CARD.base + CARD.chips };
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

/** Inset of a container's children: side/bottom padding, and the header band at the top. */
export const CONTAINER_PAD = 24;
export const CONTAINER_HEADER = 48;
const PAD = CONTAINER_PAD;
const HEADER = CONTAINER_HEADER;
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
