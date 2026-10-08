/** Maps the design document to React Flow nodes and edges. Pure. */
import type { Edge, Node } from "@xyflow/react";

import { EDGE_KIND_META, NODE_KIND_META } from "@/lib/design/catalog";
import { nodeSize } from "@/lib/design/geometry";
import type { LevelView } from "@/lib/design/levels";
import type { DesignDocument, DesignEdge, DesignNode } from "@/lib/design/schema";
import type { ComponentStatus } from "@/lib/design/status";

export type FlowNodeData = {
  node: DesignNode;
  status: { status: ComponentStatus; note: string } | null;
  /** Levels view: a container shown as a summary card, with its direct child count. */
  collapsed?: number;
  /** Levels view: a read-only node outside the focus, with its path. */
  context?: string;
};
export type FlowNode = Node<FlowNodeData>;
export type FlowEdgeData = {
  edge: DesignEdge;
  caption: string;
  /** Levels view: how many design edges this derived edge stands for (absent for real edges). */
  lifted?: number;
};
export type FlowEdge = Edge<FlowEdgeData>;

export function toFlowNodes(
  doc: DesignDocument,
  statuses: Record<string, { status: ComponentStatus; note: string }>,
  selected: ReadonlySet<string>,
  view?: LevelView,
): FlowNode[] {
  if (view) return levelNodes(view, statuses, selected);
  // doc.nodes is stored parents-first, which React Flow requires.
  return doc.nodes.map((n) => {
    const container = NODE_KIND_META[n.kind].container;
    const status = statuses[n.id] ?? null;
    return {
      id: n.id,
      type: n.kind,
      position: n.position,
      ...(n.parentId ? { parentId: n.parentId } : {}),
      data: { node: n, status },
      ...(container ? { width: nodeSize(n).width, height: nodeSize(n).height } : {}),
      selected: selected.has(n.id),
      zIndex: container ? 0 : 1,
    };
  });
}

function levelNodes(
  view: LevelView,
  statuses: Record<string, { status: ComponentStatus; note: string }>,
  selected: ReadonlySet<string>,
): FlowNode[] {
  const inside = view.inside.map(({ node: n, parentId, position, collapsed }): FlowNode => {
    const status = statuses[n.id] ?? null;
    if (collapsed !== null) {
      return {
        id: n.id,
        type: "summary",
        position,
        data: { node: n, status, collapsed },
        selected: selected.has(n.id),
        zIndex: 1,
      };
    }
    const container = NODE_KIND_META[n.kind].container;
    return {
      id: n.id,
      type: n.kind,
      position,
      ...(parentId ? { parentId } : {}),
      // A focused module sits at a made-up position: there is nothing to drag it to.
      ...(view.focus?.kind === "module" ? { draggable: false } : {}),
      data: { node: n, status },
      ...(container ? { width: nodeSize(n).width, height: nodeSize(n).height } : {}),
      selected: selected.has(n.id),
      zIndex: container ? 0 : 1,
    };
  });
  const context = view.context.map(({ node: n, path, position }): FlowNode => ({
    id: n.id,
    type: "summary",
    position,
    data: { node: n, status: statuses[n.id] ?? null, context: path },
    selected: selected.has(n.id),
    draggable: false,
    deletable: false,
    zIndex: 1,
  }));
  return [...inside, ...context];
}

const CARDINALITY = { "one-to-one": "1—1", "one-to-many": "1—N", "many-to-many": "N—N" } as const;

/** The pill text shown on an edge: its kind plus the detail that matters for that kind. */
export function edgeCaption(edge: DesignEdge, nodes: ReadonlyMap<string, DesignNode>): string {
  const base = edge.label || EDGE_KIND_META[edge.kind].label;
  switch (edge.kind) {
    case "calls":
      return `${base} · ${edge.data.protocol}`;
    case "accesses":
      return `${base} · ${edge.data.mode}`;
    case "relation":
      return CARDINALITY[edge.data.cardinality];
    case "publishes":
    case "subscribes": {
      const queue = nodes.get(edge.target);
      const channel =
        queue?.kind === "queue"
          ? queue.data.channels.find((c) => c.id === edge.data.channelId)
          : null;
      return channel ? `${base} · ${channel.name}` : base;
    }
    default:
      return base;
  }
}

export function toFlowEdges(
  doc: DesignDocument,
  selected: ReadonlySet<string>,
  view?: LevelView,
): FlowEdge[] {
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  if (view) {
    return view.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "design",
      data: {
        edge: e.edge,
        caption: e.lifted ? EDGE_KIND_META[e.kind].label : edgeCaption(e.edge, nodes),
        ...(e.lifted ? { lifted: e.lifted } : {}),
      },
      animated: e.kind === "publishes" || e.kind === "subscribes",
      selected: !e.lifted && selected.has(e.id),
      ...(e.lifted ? { selectable: false, deletable: false } : {}),
      zIndex: 2,
    }));
  }
  return doc.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "design",
    data: { edge: e, caption: edgeCaption(e, nodes) },
    animated: e.kind === "publishes" || e.kind === "subscribes",
    selected: selected.has(e.id),
    zIndex: 2,
  }));
}

/** Keeps React Flow's measured sizes when nodes are rebuilt, so they don't flash while re-measuring. */
export function keepMeasured(next: FlowNode[], previous: FlowNode[]): FlowNode[] {
  const byId = new Map(previous.map((n) => [n.id, n]));
  return next.map((n) => {
    const old = byId.get(n.id);
    // A node that changed type (a container collapsing to a summary card) must be re-measured.
    return old?.measured && old.type === n.type ? { ...n, measured: old.measured } : n;
  });
}
