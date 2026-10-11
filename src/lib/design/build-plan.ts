/** Dependency-ordered implementation steps for a design (what to build first). */
import type { DesignIndex } from "@/lib/design/graph";
import type { ComponentStatus } from "@/lib/design/status";
import type { DesignNode, EdgeKind, NodeKind } from "@/lib/design/schema";

export interface BuildStep {
  order: number; // 1-based
  id: string; // node id, or "setup"
  kind: NodeKind | "setup";
  title: string;
  path: string; // index.path(id)
  dependsOn: string[]; // step ids that must come first (direct)
  status: ComponentStatus | null;
  /** One or two sentences; ends with a pointer to the tool that gives the details. */
  instruction: string;
  cycle?: true; // emitted while breaking a dependency cycle
}

const KIND_PRIORITY: Partial<Record<NodeKind, number>> = {
  datastore: 0,
  entity: 1,
  queue: 2,
  integration: 3,
  api: 4,
  service: 5,
  layer: 6,
  module: 7,
  resource: 1,
  content: 2,
  system: 5,
  mechanic: 7,
};

/** Design context only: nothing to build. */
const CONTEXT_KINDS: ReadonlySet<NodeKind> = new Set(["actor", "note", "loop"]);
/** Edges that describe runtime or gameplay flow, not what must exist first. */
const NO_ORDER_EDGES: ReadonlySet<EdgeKind> = new Set([
  "relation",
  "interacts",
  "drives",
  "triggers",
]);

export function buildPlan(
  index: DesignIndex,
  statuses?: Map<string, ComponentStatus>,
): BuildStep[] {
  const { doc } = index;
  const candidates = doc.nodes.filter((n) => !CONTEXT_KINDS.has(n.kind));
  const ids = new Set(candidates.map((n) => n.id));
  const docOrder = new Map(candidates.map((n, i) => [n.id, i]));

  // predecessors: node → nodes that must be built before it
  const before = new Map<string, Set<string>>(candidates.map((n) => [n.id, new Set()]));
  const needs = (first: string, then: string) => {
    if (first !== then && ids.has(first) && ids.has(then)) before.get(then)!.add(first);
  };

  for (const e of doc.edges) {
    if (NO_ORDER_EDGES.has(e.kind)) continue;
    needs(e.target, e.source); // the target of depends_on/calls/exposes/accesses/… comes first
  }
  for (const n of candidates) {
    if (n.parentId) needs(n.parentId, n.id);
    if (n.kind === "entity") {
      for (const f of n.data.fields) if (f.refEntityId) needs(f.refEntityId, n.id);
    }
    if (n.kind === "api") {
      for (const op of n.data.operations) {
        for (const shape of [op.request, op.response])
          if (shape?.entityId) needs(shape.entityId, n.id);
      }
    }
    if (n.kind === "queue") {
      for (const ch of n.data.channels) if (ch.payload.entityId) needs(ch.payload.entityId, n.id);
    }
  }

  const successors = new Map<string, string[]>(candidates.map((n) => [n.id, []]));
  const remaining = new Map<string, number>();
  for (const [id, preds] of before) {
    remaining.set(id, preds.size);
    for (const p of preds) successors.get(p)!.push(id);
  }

  const rank = (id: string) =>
    [KIND_PRIORITY[index.node(id)!.kind] ?? 9, docOrder.get(id)!] as const;
  const compare = (a: string, b: string) => {
    const [pa, oa] = rank(a);
    const [pb, ob] = rank(b);
    return pa - pb || oa - ob;
  };

  const emitted = new Set<string>();
  const order: { id: string; cycle: boolean }[] = [];
  const ready = candidates.filter((n) => remaining.get(n.id) === 0).map((n) => n.id);
  const release = (id: string) => {
    for (const next of successors.get(id)!) {
      if (emitted.has(next)) continue;
      const left = remaining.get(next)! - 1;
      remaining.set(next, left);
      if (left === 0) ready.push(next);
    }
  };

  while (order.length < candidates.length) {
    let id: string;
    let cycle = false;
    if (ready.length > 0) {
      ready.sort(compare);
      id = ready.shift()!;
    } else {
      id = candidates
        .map((n) => n.id)
        .filter((c) => !emitted.has(c))
        .sort(compare)[0]!;
      cycle = true;
    }
    emitted.add(id);
    order.push({ id, cycle });
    release(id);
  }

  const status = (id: string) => statuses?.get(id) ?? null;
  const steps: BuildStep[] = [
    {
      order: 1,
      id: "setup",
      kind: "setup",
      title: "Repository & tooling",
      path: "Repository",
      dependsOn: [],
      status: null,
      instruction: setupInstruction(index),
    },
  ];
  for (const { id, cycle } of order) {
    const node = index.node(id)!;
    const preds = [...before.get(id)!].sort(compare);
    const step: BuildStep = {
      order: steps.length + 1,
      id,
      kind: node.kind,
      title: titleFor(node),
      path: index.path(id),
      dependsOn: preds.length > 0 ? preds : ["setup"],
      status: status(id),
      instruction: `${instructionFor(index, node)} Details: get_component("${id}").`,
    };
    if (cycle) step.cycle = true;
    steps.push(step);
  }
  return steps;
}

function setupInstruction(index: DesignIndex): string {
  const { overview, stack, conventions } = index.doc;
  const projectStack = stack.filter((s) => s.scope.length === 0).map((s) => s.name);
  const musts = conventions.filter((c) => c.level === "must").length;
  return (
    `Set up the ${overview.repository.layout} repository` +
    (overview.repository.packageManager ? ` with ${overview.repository.packageManager}` : "") +
    (projectStack.length > 0 ? `, the project-wide stack (${projectStack.join(", ")})` : "") +
    `, lint and test tooling, and the ${musts} MUST convention${musts === 1 ? "" : "s"}. ` +
    "Details: get_project_brief."
  );
}

function titleFor(n: DesignNode): string {
  switch (n.kind) {
    case "datastore":
      return `Provision ${n.name}`;
    case "entity":
      return `Model ${n.name}`;
    case "queue":
      return `Set up ${n.name}`;
    case "integration":
      return `Integrate ${n.name}`;
    case "api":
      return `Define ${n.name}`;
    case "service":
      return `Scaffold ${n.name}`;
    case "layer":
      return `Create ${n.name} layer`;
    case "resource":
      return `Define ${n.name}`;
    case "content":
      return `Author ${n.name}`;
    default:
      return `Implement ${n.name}`;
  }
}

const list = (items: string[], fallback: string, max = 8) =>
  items.length === 0
    ? fallback
    : items.slice(0, max).join(", ") + (items.length > max ? `, +${items.length - max} more` : "");

function instructionFor(index: DesignIndex, n: DesignNode): string {
  switch (n.kind) {
    case "datastore":
      return `Provision ${[n.data.engine, n.data.version].filter(Boolean).join(" ")}${n.data.purpose ? ` for ${n.data.purpose}` : ""}.`;
    case "entity": {
      const parent = n.parentId ? index.node(n.parentId) : undefined;
      if (parent?.kind === "datastore") {
        return `Create the ${n.name} table/collection (${list(
          n.data.fields.map((f) => f.name),
          "no fields yet",
        )}) and its migration.`;
      }
      return `Define the ${n.name} type in ${parent ? index.path(parent.id) : "the domain"}.`;
    }
    case "queue":
      return `Set up ${n.data.technology} with typed producers/consumers for ${list(
        n.data.channels.map((c) => c.name),
        "its channels",
      )}.`;
    case "integration":
      return `Wrap ${n.data.provider || n.name}${n.data.sdk ? ` (${n.data.sdk})` : ""} behind an adapter; credentials from ${list(
        n.data.env.map((e) => e.name),
        "environment variables",
      )}.`;
    case "api":
      return `Define the ${n.data.style} contract for ${list(
        n.data.operations.map((o) => o.name),
        "its operations",
      )}; use get_api_contract("${n.id}").`;
    case "service": {
      const stack = [n.data.language, n.data.framework].filter(Boolean).join("/");
      return `Scaffold the ${n.data.type}${n.data.path ? ` at ${n.data.path}` : ""}${stack ? ` with ${stack}` : ""}.`;
    }
    case "layer": {
      const allowed = index
        .outgoing(n.id, "depends_on")
        .map((e) => index.node(e.target)?.name)
        .filter((x): x is string => !!x);
      const rules = n.data.rules.length > 0 ? `; enforce ${list(n.data.rules, "", 4)}` : "";
      return `Create ${n.data.path || n.name}${rules}; may depend on ${list(allowed, "no other layer")}.`;
    }
    case "module":
      return `Implement ${n.name} in ${n.data.path || index.path(n.id)} exposing ${list(n.data.exports, "its responsibilities")}.`;
    case "system": {
      const parts = index.children(n.id).filter((c) => c.kind === "mechanic");
      return `Implement the ${n.name} system as one feature module (${n.data.category}${
        n.data.authority !== "unspecified" ? `, ${n.data.authority}-authoritative` : ""
      }) with pure, tested domain logic; mechanics: ${list(
        parts.map((c) => c.name),
        "none yet",
      )}.`;
    }
    case "mechanic":
      return `Implement ${n.name}${n.data.trigger ? ` (trigger: ${n.data.trigger})` : ""} following its rules, parameters and formulas exactly.`;
    case "resource":
      return `Define the ${n.data.type} ${n.name}${
        n.data.initial
          ? ` (initial ${n.data.initial}${n.data.max ? `, max ${n.data.max}` : ""})`
          : ""
      } with its sources and sinks.`;
    case "content":
      return `Author ${n.name} as data assets with stable ids (${list(n.data.columns, "no columns yet")}).`;
    default:
      return `Implement ${n.name}.`;
  }
}
