/**
 * Perspectives: the same design seen by different readers, the way Blender shows one scene in
 * several editors. Architecture is the editable canvas itself (levels.ts); the API and Layers
 * perspectives are generated, auto-laid-out diagrams built here. Pure; the canvas maps the
 * result to React Flow.
 *
 * Navigation is independent of the perspective: "all" shows the detail (actual modules),
 * "levels" shows the overview at the focused level, scoped to the focus.
 *
 * - API: every API with its operations; implementers (exposes) on the left, consumers (calls)
 *   on the right. A node can sit beside several APIs, so its copies get ids `<api>~<side>~<id>`.
 * - Layers: each service as a frame, its layers stacked top to bottom in depends_on order with
 *   their modules inside; module dependencies that break the layer rules are flagged.
 */
import type { Point } from "@/lib/design/geometry";
import { indexDesign, type DesignIndex } from "@/lib/design/graph";
import { isFocusable } from "@/lib/design/levels";
import type { DesignDocument, DesignEdge, DesignNode, EdgeKind } from "@/lib/design/schema";
import { isLayerViolation } from "@/lib/design/validate";

export const PERSPECTIVES = ["architecture", "api", "layers"] as const;
export type Perspective = (typeof PERSPECTIVES)[number];

export const PERSPECTIVE_META: Record<Perspective, { label: string; description: string }> = {
  architecture: { label: "Architecture", description: "The whole system: edit it here" },
  api: { label: "API", description: "Who implements and who calls each API" },
  layers: { label: "Layers", description: "Each service's layers and the rules between them" },
};

export interface PerspectiveNode {
  /** The React Flow id: the design node id, or `<prefix>~<id>` for a copy or a pseudo node. */
  id: string;
  node: DesignNode;
  role: "card" | "api" | "frame" | "band";
  /** Parent's React Flow id; null at the top level. */
  parentId: string | null;
  /** Relative to the parent. */
  position: Point;
  /** Fixed size for frames, bands and API cards; null for cards that size themselves. */
  size: { width: number; height: number } | null;
  /** Card: where a nested node lives. Band or frame: a caption replacing the node's own. */
  label?: string;
  /** Collapsed band: how many components sit in it. */
  count?: number;
}

export interface PerspectiveEdge {
  /** The design edge id, or `lift:<kind>:<source>:<target>` for an edge standing for several. */
  id: string;
  kind: EdgeKind;
  source: string;
  target: string;
  /** The design edge (for a lifted edge, the first one it stands for). */
  edge: DesignEdge;
  /** How many design edges a lifted edge stands for; 0 for a real edge. */
  lifted: number;
  /** Breaks the layer rules (see validate.ts `isLayerViolation`). */
  violation: boolean;
}

export interface PerspectiveView {
  /** Parents first, as React Flow requires. */
  nodes: PerspectiveNode[];
  edges: PerspectiveEdge[];
  /** Why there is nothing to show, when there isn't. */
  empty: string | null;
}

export interface PerspectiveScope {
  viewMode: "all" | "levels";
  focusId: string | null;
}

/** The design node id behind a React Flow id (copies and pseudo nodes carry a `~` prefix). */
export function designIdOf(flowId: string): string {
  return flowId.slice(flowId.lastIndexOf("~") + 1);
}

/** Size the auto layout reserves for a card (status chips make some taller). */
export const CARD = { width: 208, height: 72 } as const;
export const API_CARD = { width: 288, header: 60, row: 22, footer: 12, maxRows: 12 } as const;
const GAP = { card: 24, column: 176, row: 72, frame: 160 } as const;
const FRAME = { header: 44, pad: 16 } as const;
const BAND = { header: 36, collapsed: 44, gap: 48, pad: 16, empty: 20, cols: 3 } as const;

/** Rendered height of an API card listing its operations. */
export function apiCardHeight(operations: number): number {
  const rows = Math.max(
    1,
    Math.min(operations, API_CARD.maxRows) + (operations > API_CARD.maxRows ? 1 : 0),
  );
  return API_CARD.header + rows * API_CARD.row + API_CARD.footer;
}

export function perspectiveView(
  doc: DesignDocument,
  perspective: Exclude<Perspective, "architecture">,
  scope: PerspectiveScope,
): PerspectiveView {
  return perspective === "api" ? apiPerspective(doc, scope) : layersPerspective(doc, scope);
}

function focusOf(index: DesignIndex, scope: PerspectiveScope): DesignNode | null {
  if (scope.viewMode !== "levels" || !scope.focusId) return null;
  const n = index.node(scope.focusId);
  return n && isFocusable(n) ? n : null;
}

/** Where a nested node lives, for a card's subtitle: "API › Application". */
function parentPath(index: DesignIndex, n: DesignNode): string | undefined {
  return n.parentId ? index.path(n.parentId) : undefined;
}

// ── API ─────────────────────────────────────────────────────────────────────

export function apiPerspective(doc: DesignDocument, scope: PerspectiveScope): PerspectiveView {
  const index = indexDesign(doc);
  const focus = focusOf(index, scope);
  const inFocus = focus
    ? new Set([focus.id, ...index.descendants(focus.id).map((n) => n.id)])
    : null;

  /** The node that stands for `id` at this level: itself in the "all" view. */
  const representative = (id: string): string => {
    if (scope.viewMode === "all") return id;
    const chain = [index.node(id)!, ...index.ancestors(id)];
    const at = focus ? chain.findIndex((n) => n.id === focus.id) : -1;
    if (at === 0) return id;
    if (at > 0) return chain[at - 1]!.id;
    return chain.at(-1)!.id;
  };

  const nodes: PerspectiveNode[] = [];
  const edges: PerspectiveEdge[] = [];
  let y = 0;
  const apis = index.children(null).filter((n) => n.kind === "api");
  for (const api of apis) {
    if (api.kind !== "api") continue;
    const exposes = index.incoming(api.id, "exposes");
    const calls = index.incoming(api.id, "calls");
    if (inFocus && ![...exposes, ...calls].some((e) => inFocus.has(e.source))) continue;

    const side = (list: DesignEdge[], tag: "i" | "c") => {
      const groups = new Map<string, DesignEdge[]>();
      for (const e of list) {
        const rep = representative(e.source);
        groups.set(rep, [...(groups.get(rep) ?? []), e]);
      }
      return [...groups].map(([rep, group]) => ({ rep, group, flowId: `${api.id}~${tag}~${rep}` }));
    };
    const left = side(exposes, "i");
    const right = side(calls, "c");

    const apiHeight = apiCardHeight(api.data.operations.length);
    const stack = (n: number) => (n > 0 ? n * CARD.height + (n - 1) * GAP.card : 0);
    const rowHeight = Math.max(apiHeight, stack(left.length), stack(right.length));
    const apiX = CARD.width + GAP.column;
    nodes.push({
      id: api.id,
      node: api,
      role: "api",
      parentId: null,
      position: { x: apiX, y: y + (rowHeight - apiHeight) / 2 },
      size: { width: API_CARD.width, height: apiHeight },
    });
    const place = (items: typeof left, x: number, kind: "exposes" | "calls") => {
      let top = y + (rowHeight - stack(items.length)) / 2;
      for (const { rep, group, flowId } of items) {
        const n = index.node(rep)!;
        nodes.push({
          id: flowId,
          node: n,
          role: "card",
          parentId: null,
          position: { x, y: top },
          size: null,
          label: parentPath(index, n),
        });
        top += CARD.height + GAP.card;
        const real = group.length === 1 && group[0]!.source === rep;
        edges.push({
          id: real ? group[0]!.id : `lift:${kind}:${rep}:${api.id}`,
          kind,
          // Consumers sit on the right but still point at the API they call.
          source: flowId,
          target: api.id,
          edge: group[0]!,
          lifted: real ? 0 : group.length,
          violation: false,
        });
      }
    };
    place(left, 0, "exposes");
    place(right, apiX + API_CARD.width + GAP.column, "calls");
    y += rowHeight + GAP.row;
  }

  let empty: string | null = null;
  if (nodes.length === 0)
    empty = focus
      ? `Nothing in ${focus.name} implements or calls an API.`
      : "No APIs yet. Add one in the Architecture perspective.";
  return { nodes, edges, empty };
}

// ── Layers ──────────────────────────────────────────────────────────────────

/** Layers top to bottom: a layer sits above the layers it depends on. Cycles keep canvas order. */
export function layerOrder(index: DesignIndex, layers: DesignNode[]): DesignNode[] {
  const ids = new Set(layers.map((l) => l.id));
  const indegree = new Map(layers.map((l) => [l.id, 0]));
  for (const l of layers)
    for (const e of index.outgoing(l.id, "depends_on"))
      if (ids.has(e.target) && e.target !== l.id)
        indegree.set(e.target, indegree.get(e.target)! + 1);
  const out: DesignNode[] = [];
  const done = new Set<string>();
  while (out.length < layers.length) {
    // The first ready layer in canvas order; with a cycle, the first one left.
    const next =
      layers.find((l) => !done.has(l.id) && indegree.get(l.id) === 0) ??
      layers.find((l) => !done.has(l.id))!;
    done.add(next.id);
    out.push(next);
    for (const e of index.outgoing(next.id, "depends_on"))
      if (ids.has(e.target) && !done.has(e.target))
        indegree.set(e.target, indegree.get(e.target)! - 1);
  }
  return out;
}

const LAYER_ITEMS = new Set<DesignNode["kind"]>(["module", "entity"]);

export function layersPerspective(doc: DesignDocument, scope: PerspectiveScope): PerspectiveView {
  const index = indexDesign(doc);
  const focus = focusOf(index, scope);
  const collapsed = scope.viewMode === "levels" && !focus;
  const services = focus
    ? [index.serviceOf(focus.id)].filter((s) => s !== null)
    : index.children(null).filter((n) => n.kind === "service");

  const nodes: PerspectiveNode[] = [];
  /** Band (React Flow id) of each design node drawn in this view. */
  const bandOf = new Map<string, string>();
  const shownCards = new Set<string>();
  let x = 0;
  for (const service of services) {
    const children = index.children(service.id);
    const layers = layerOrder(
      index,
      children.filter((n) => n.kind === "layer"),
    );
    const bands = layers.map((l) => ({
      id: l.id,
      node: l,
      label: undefined as string | undefined,
      items: index.children(l.id).filter((n) => LAYER_ITEMS.has(n.kind)),
    }));
    const direct = children.filter((n) => LAYER_ITEMS.has(n.kind));
    if (direct.length > 0)
      bands.push({
        id: `${service.id}~direct`,
        node: service,
        label: "Not in a layer",
        items: direct,
      });

    const cols = Math.min(BAND.cols, Math.max(1, ...bands.map((b) => b.items.length)));
    const bandWidth = BAND.pad * 2 + cols * CARD.width + (cols - 1) * GAP.card;
    const frameWidth = bandWidth + FRAME.pad * 2;
    const frame: PerspectiveNode = {
      id: service.id,
      node: service,
      role: "frame",
      parentId: null,
      position: { x, y: 0 },
      size: { width: frameWidth, height: 0 },
      ...(bands.length === 0 ? { label: "No layers yet" } : {}),
    };
    nodes.push(frame);

    let y = FRAME.header;
    for (const band of bands) {
      const rows = Math.ceil(band.items.length / cols);
      const height = collapsed
        ? BAND.collapsed
        : BAND.header +
          (rows > 0 ? rows * CARD.height + (rows - 1) * GAP.card + BAND.pad : BAND.empty);
      nodes.push({
        id: band.id,
        node: band.node,
        role: "band",
        parentId: service.id,
        position: { x: FRAME.pad, y },
        size: { width: bandWidth, height },
        ...(band.label ? { label: band.label } : {}),
        ...(collapsed ? { count: band.items.length } : {}),
      });
      for (const item of band.items) bandOf.set(item.id, band.id);
      if (!collapsed)
        band.items.forEach((item, i) => {
          shownCards.add(item.id);
          nodes.push({
            id: item.id,
            node: item,
            role: "card",
            parentId: band.id,
            position: {
              x: BAND.pad + (i % cols) * (CARD.width + GAP.card),
              y: BAND.header + Math.floor(i / cols) * (CARD.height + GAP.card),
            },
            size: null,
          });
        });
      y += height + BAND.gap;
    }
    frame.size = {
      width: frameWidth,
      height: bands.length > 0 ? y - BAND.gap + FRAME.pad : FRAME.header + BAND.empty + FRAME.pad,
    };
    x += frameWidth + GAP.frame;
  }

  const shownBands = new Set(nodes.filter((n) => n.role === "band").map((n) => n.id));
  const edges: PerspectiveEdge[] = [];
  const lifted = new Map<string, PerspectiveEdge>();
  for (const e of doc.edges) {
    if (e.kind === "depends_on" && shownBands.has(e.source) && shownBands.has(e.target)) {
      edges.push({
        id: e.id,
        kind: e.kind,
        source: e.source,
        target: e.target,
        edge: e,
        lifted: 0,
        violation: false,
      });
      continue;
    }
    if (e.kind !== "depends_on" && e.kind !== "calls") continue;
    if (!collapsed) {
      if (shownCards.has(e.source) && shownCards.has(e.target))
        edges.push({
          id: e.id,
          kind: e.kind,
          source: e.source,
          target: e.target,
          edge: e,
          lifted: 0,
          violation: isLayerViolation(index, e),
        });
      continue;
    }
    // Overview: only the dependencies that break the rules are worth lifting to their bands.
    const a = bandOf.get(e.source);
    const b = bandOf.get(e.target);
    if (!a || !b || a === b || !isLayerViolation(index, e)) continue;
    const key = `${e.kind}:${a}:${b}`;
    const existing = lifted.get(key);
    if (existing) existing.lifted++;
    else
      lifted.set(key, {
        id: `lift:${key}`,
        kind: e.kind,
        source: a,
        target: b,
        edge: e,
        lifted: 1,
        violation: true,
      });
  }
  edges.push(...lifted.values());

  let empty: string | null = null;
  if (nodes.length === 0)
    empty = focus
      ? `${focus.name} isn't part of a service. Layers live inside services.`
      : "No services yet. Add one in the Architecture perspective.";
  return { nodes, edges, empty };
}
