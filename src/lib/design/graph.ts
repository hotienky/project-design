/** Read-only index over a design document: lookups, containment and scoping. Built once, O(n + e). */
import type {
  Convention,
  DesignDocument,
  DesignEdge,
  DesignNode,
  EdgeKind,
  EdgeOfKind,
  NodeOfKind,
  StackItem,
} from "@/lib/design/schema";

export interface DesignIndex {
  doc: DesignDocument;
  node(id: string): DesignNode | undefined;
  /** Children of a node (null = top level), sorted by position.y then position.x then name. */
  children(parentId: string | null): DesignNode[];
  ancestors(id: string): DesignNode[]; // nearest first
  descendants(id: string): DesignNode[]; // depth-first, children order
  outgoing(id: string): DesignEdge[];
  outgoing<K extends EdgeKind>(id: string, kind: K): EdgeOfKind<K>[];
  incoming(id: string): DesignEdge[];
  incoming<K extends EdgeKind>(id: string, kind: K): EdgeOfKind<K>[];
  /** "API › Application › Task use cases" */
  path(id: string): string;
  serviceOf(id: string): NodeOfKind<"service"> | null; // itself or nearest ancestor service
  layerOf(id: string): NodeOfKind<"layer"> | null;
  /**
   * Stack that applies to a node: items scoped to the node or an ancestor (nearest scope wins
   * per category) + project-wide items whose category is not overridden. Project order kept.
   */
  stackFor(id: string): StackItem[];
  conventionsFor(id: string): Convention[]; // project-wide + scoped to node or ancestors
  findByName(name: string): DesignNode[]; // case-insensitive exact match
}

function byPosition(a: DesignNode, b: DesignNode): number {
  return a.position.y - b.position.y || a.position.x - b.position.x || a.name.localeCompare(b.name);
}

export function indexDesign(doc: DesignDocument): DesignIndex {
  const nodes = new Map<string, DesignNode>();
  const childMap = new Map<string | null, DesignNode[]>();
  const out = new Map<string, DesignEdge[]>();
  const inc = new Map<string, DesignEdge[]>();

  for (const n of doc.nodes) {
    nodes.set(n.id, n);
    const key = n.parentId ?? null;
    const list = childMap.get(key);
    if (list) list.push(n);
    else childMap.set(key, [n]);
  }
  for (const list of childMap.values()) list.sort(byPosition);
  for (const e of doc.edges) {
    (out.get(e.source) ?? out.set(e.source, []).get(e.source)!).push(e);
    (inc.get(e.target) ?? inc.set(e.target, []).get(e.target)!).push(e);
  }

  const node = (id: string) => nodes.get(id);
  const children = (parentId: string | null) => childMap.get(parentId) ?? [];

  function ancestors(id: string): DesignNode[] {
    const result: DesignNode[] = [];
    const seen = new Set<string>([id]);
    let current = nodes.get(id)?.parentId ?? null;
    while (current && !seen.has(current)) {
      const parent = nodes.get(current);
      if (!parent) break;
      result.push(parent);
      seen.add(current);
      current = parent.parentId;
    }
    return result;
  }

  function descendants(id: string): DesignNode[] {
    const result: DesignNode[] = [];
    const visit = (parent: string) => {
      for (const child of children(parent)) {
        result.push(child);
        visit(child.id);
      }
    };
    visit(id);
    return result;
  }

  function nearest<K extends "service" | "layer">(id: string, kind: K): NodeOfKind<K> | null {
    const self = nodes.get(id);
    if (self?.kind === kind) return self as NodeOfKind<K>;
    return (ancestors(id).find((a) => a.kind === kind) as NodeOfKind<K> | undefined) ?? null;
  }

  /** The node itself, then its ancestors: the chain whose scopes apply to it. */
  const chainIds = (id: string) => [id, ...ancestors(id).map((a) => a.id)];

  return {
    doc,
    node,
    children,
    ancestors,
    descendants,
    outgoing: ((id: string, kind?: EdgeKind) =>
      (out.get(id) ?? []).filter((e) => !kind || e.kind === kind)) as DesignIndex["outgoing"],
    incoming: ((id: string, kind?: EdgeKind) =>
      (inc.get(id) ?? []).filter((e) => !kind || e.kind === kind)) as DesignIndex["incoming"],
    path(id) {
      const self = nodes.get(id);
      if (!self) return id;
      return [...ancestors(id).reverse(), self].map((n) => n.name).join(" › ");
    },
    serviceOf: (id) => nearest(id, "service"),
    layerOf: (id) => nearest(id, "layer"),
    stackFor(id) {
      const chain = chainIds(id);
      const winners = new Map<string, number>(); // category → nearest chain depth that scopes it
      for (const item of doc.stack) {
        const depth = chain.findIndex((c) => item.scope.includes(c));
        if (depth < 0) continue;
        const best = winners.get(item.category);
        if (best === undefined || depth < best) winners.set(item.category, depth);
      }
      return doc.stack.filter((item) => {
        const best = winners.get(item.category);
        if (item.scope.length === 0) return best === undefined;
        return chain.findIndex((c) => item.scope.includes(c)) === best;
      });
    },
    conventionsFor(id) {
      const chain = chainIds(id);
      return doc.conventions.filter(
        (c) => c.scope.length === 0 || c.scope.some((s) => chain.includes(s)),
      );
    },
    findByName(name) {
      const wanted = name.trim().toLowerCase();
      return doc.nodes.filter((n) => n.name.toLowerCase() === wanted);
    },
  };
}
