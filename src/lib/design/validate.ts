/** Quality checks on a design. Structural errors come from integrity.ts; this adds warnings and hints. */
import { nodeSize } from "@/lib/design/geometry";
import { indexDesign, type DesignIndex } from "@/lib/design/graph";
import { checkIntegrity, type Issue } from "@/lib/design/integrity";
import type { DesignDocument, DesignEdge, DesignNode } from "@/lib/design/schema";

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

export function validateDesign(doc: DesignDocument): Issue[] {
  const issues: Issue[] = [...checkIntegrity(doc)];
  const index = indexDesign(doc);
  const add = (
    severity: Issue["severity"],
    code: string,
    message: string,
    refs: { nodeId?: string; edgeId?: string } = {},
  ) => issues.push({ severity, code, message, ...refs });

  if (doc.nodes.length === 0) add("info", "design.empty", "The design has no components yet.");
  if (!doc.overview.summary.trim()) {
    add("info", "overview.no_summary", "The overview has no summary.");
  }

  checkServices(doc, add);
  checkNames(doc, add);
  checkLayers(index, add);
  checkCycles(index, add);
  checkApis(index, add);
  checkData(index, add);
  checkMessaging(index, add);
  checkOverlaps(doc, add);

  for (const n of doc.nodes) {
    if (n.kind === "integration" && index.incoming(n.id, "uses").length === 0) {
      add(
        "warning",
        "integration.unused",
        `Integration "${n.name}" is not used by any component.`,
        {
          nodeId: n.id,
        },
      );
    }
  }

  const nodeOrder = new Map(doc.nodes.map((n, i) => [n.id, i]));
  const edgeOrder = new Map(doc.edges.map((e) => [e.id, nodeOrder.get(e.source) ?? -1]));
  const position = (issue: Issue) =>
    issue.nodeId !== undefined
      ? (nodeOrder.get(issue.nodeId) ?? -1)
      : issue.edgeId !== undefined
        ? (edgeOrder.get(issue.edgeId) ?? -1)
        : -1;
  return issues
    .map((issue, i) => ({ issue, i }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.issue.severity] - SEVERITY_ORDER[b.issue.severity] ||
        position(a.issue) - position(b.issue) ||
        a.i - b.i,
    )
    .map((x) => x.issue);
}

type Add = (
  severity: Issue["severity"],
  code: string,
  message: string,
  refs?: { nodeId?: string; edgeId?: string },
) => void;

function checkServices(doc: DesignDocument, add: Add) {
  const services = doc.nodes.filter((n) => n.kind === "service");

  const hasProjectLanguage = doc.stack.some(
    (s) => s.category === "language" && s.scope.length === 0,
  );
  if (!hasProjectLanguage) {
    for (const s of services) {
      if (s.data.language === "") {
        add(
          "warning",
          "stack.no_language",
          "No project-wide language is chosen in the tech stack, and service " +
            `"${s.name}" does not set one.`,
          { nodeId: s.id },
        );
        break;
      }
    }
  }

  if (services.length > 1) {
    for (const s of services) {
      if (s.data.path === "") {
        add("warning", "service.no_path", `Service "${s.name}" has no path in the repository.`, {
          nodeId: s.id,
        });
      }
    }
  }
  const byPath = new Map<string, typeof services>();
  for (const s of services) {
    if (s.data.path === "") continue;
    byPath.set(s.data.path, [...(byPath.get(s.data.path) ?? []), s]);
  }
  for (const [path, group] of byPath) {
    if (group.length > 1) {
      add(
        "warning",
        "service.duplicate_path",
        `Services ${group.map((s) => `"${s.name}"`).join(" and ")} share the path "${path}".`,
        { nodeId: group[1]!.id },
      );
    }
  }

  for (const n of doc.nodes) {
    if (n.kind !== "service" && n.kind !== "integration") continue;
    const seen = new Set<string>();
    for (const v of n.data.env) {
      if (seen.has(v.name)) {
        add("warning", "env.duplicate", `"${n.name}" declares ${v.name} more than once.`, {
          nodeId: n.id,
        });
      }
      seen.add(v.name);
    }
  }
}

function checkNames(doc: DesignDocument, add: Add) {
  const seen = new Map<string, DesignNode>();
  for (const n of doc.nodes) {
    const key = `${n.parentId ?? ""}|${n.kind}|${n.name.toLowerCase()}`;
    if (seen.has(key)) {
      add("warning", "node.duplicate_name", `Two ${n.kind}s are both named "${n.name}" here.`, {
        nodeId: n.id,
      });
    }
    seen.set(key, n);

    const described =
      n.description.trim() !== "" ||
      ((n.kind === "service" || n.kind === "module") && n.data.responsibilities.length > 0) ||
      (n.kind === "integration" && n.data.purpose.trim() !== "");
    if (
      (n.kind === "service" ||
        n.kind === "module" ||
        n.kind === "api" ||
        n.kind === "integration") &&
      !described
    ) {
      add("info", "node.no_description", `${cap(n.kind)} "${n.name}" has no description.`, {
        nodeId: n.id,
      });
    }
  }
}

function checkLayers(index: DesignIndex, add: Add) {
  const { doc } = index;
  for (const n of doc.nodes) {
    if (n.kind === "layer" && index.children(n.id).length === 0) {
      add("info", "layer.empty", `Layer "${n.name}" contains no modules.`, { nodeId: n.id });
    }
  }
  for (const e of doc.edges) {
    if (e.kind !== "depends_on" && e.kind !== "calls") continue;
    const a = index.layerOf(e.source);
    const b = index.layerOf(e.target);
    if (!a || !b || a.id === b.id) continue;
    if (index.serviceOf(a.id)?.id !== index.serviceOf(b.id)?.id) continue;
    const allowed = index.outgoing(a.id, "depends_on").some((d) => d.target === b.id);
    if (allowed) continue;
    const from = index.node(e.source)!;
    const to = index.node(e.target)!;
    add(
      "warning",
      "layer.dependency_violation",
      `${from.name} (${a.name}) ${e.kind === "calls" ? "calls" : "depends on"} ${to.name} (${b.name}), ` +
        `but ${a.name} has no depends_on to ${b.name}`,
      { edgeId: e.id },
    );
  }
}

/** Tarjan's strongly connected components over depends_on edges. */
function checkCycles(index: DesignIndex, add: Add) {
  const { doc } = index;
  const adjacency = new Map<string, string[]>();
  for (const e of doc.edges) {
    if (e.kind === "depends_on" && e.source !== e.target) {
      adjacency.set(e.source, [...(adjacency.get(e.source) ?? []), e.target]);
    }
  }
  const order = new Map(doc.nodes.map((n, i) => [n.id, i]));
  const indexOf = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let counter = 0;

  const connect = (v: string) => {
    indexOf.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of adjacency.get(v) ?? []) {
      if (!indexOf.has(w)) {
        connect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, indexOf.get(w)!));
      }
    }
    if (low.get(v) === indexOf.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) {
        component.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
        const names = component.map((id) => index.node(id)?.name ?? id);
        add(
          "warning",
          "dependency.cycle",
          `Circular dependency: ${[...names, names[0]].join(" → ")}`,
          { nodeId: component[0] },
        );
      }
    }
  };
  for (const n of doc.nodes) if (!indexOf.has(n.id) && adjacency.has(n.id)) connect(n.id);
}

function checkApis(index: DesignIndex, add: Add) {
  for (const n of index.doc.nodes) {
    if (n.kind !== "api") continue;
    if (index.incoming(n.id, "exposes").length === 0) {
      add("warning", "api.no_implementer", `API "${n.name}" is not exposed by any service.`, {
        nodeId: n.id,
      });
    }
    if (n.data.operations.length === 0) {
      add("warning", "api.no_operations", `API "${n.name}" has no operations.`, { nodeId: n.id });
    }
    if (n.data.style !== "rest") continue;
    const routes = new Map<string, string>();
    for (const op of n.data.operations) {
      if (!op.method || !op.path) {
        add(
          "warning",
          "api.rest_incomplete",
          `Operation "${op.name}" of "${n.name}" needs a method and a path.`,
          { nodeId: n.id },
        );
        continue;
      }
      const route = `${op.method} ${op.path}`;
      const other = routes.get(route);
      if (other) {
        add(
          "warning",
          "api.duplicate_route",
          `Operations "${other}" and "${op.name}" of "${n.name}" both use ${route}.`,
          { nodeId: n.id },
        );
      } else routes.set(route, op.name);
    }
  }
}

function checkData(index: DesignIndex, add: Add) {
  const { doc } = index;
  for (const n of doc.nodes) {
    if (n.kind === "entity") {
      if (n.data.fields.length === 0) {
        add("warning", "entity.no_fields", `Entity "${n.name}" has no fields.`, { nodeId: n.id });
      } else if (
        index.node(n.parentId ?? "")?.kind === "datastore" &&
        !n.data.fields.some((f) => f.primary)
      ) {
        add("warning", "entity.no_primary_key", `Entity "${n.name}" has no primary key.`, {
          nodeId: n.id,
        });
      }
    }
    if (n.kind === "datastore") {
      const ids = [n.id, ...index.descendants(n.id).map((d) => d.id)];
      if (!ids.some((id) => index.incoming(id, "accesses").length > 0)) {
        add(
          "warning",
          "datastore.unused",
          `Datastore "${n.name}" is not accessed by any component.`,
          {
            nodeId: n.id,
          },
        );
      }
    }
  }
  for (const e of doc.edges) {
    if (e.kind !== "relation" || !e.data.foreignKey) continue;
    const target = index.node(e.target);
    if (
      target?.kind === "entity" &&
      !target.data.fields.some((f) => f.name === e.data.foreignKey)
    ) {
      add(
        "warning",
        "relation.fk_missing",
        `Relation ${index.node(e.source)?.name} → ${target.name} names foreign key ` +
          `"${e.data.foreignKey}", but ${target.name} has no such field.`,
        { edgeId: e.id },
      );
    }
  }
}

function checkMessaging(index: DesignIndex, add: Add) {
  for (const n of index.doc.nodes) {
    if (n.kind !== "queue") continue;
    if (n.data.channels.length === 0) {
      add("warning", "queue.no_channels", `Queue "${n.name}" has no channels.`, { nodeId: n.id });
    }
    const sides: [DesignEdge["kind"], string, string][] = [
      ["publishes", "queue.no_producer", "producer"],
      ["subscribes", "queue.no_consumer", "consumer"],
    ];
    for (const [kind, code, role] of sides) {
      const edges = index.incoming(n.id, kind);
      if (edges.length === 0) {
        add("warning", code, `Queue "${n.name}" has no ${role}.`, { nodeId: n.id });
        continue;
      }
      if (edges.some((e) => "channelId" in e.data && e.data.channelId === null)) continue;
      for (const ch of n.data.channels) {
        if (!edges.some((e) => "channelId" in e.data && e.data.channelId === ch.id)) {
          add("warning", code, `Channel "${ch.name}" of queue "${n.name}" has no ${role}.`, {
            nodeId: n.id,
          });
        }
      }
    }
    if (n.data.channels.length > 1) {
      for (const e of [
        ...index.incoming(n.id, "publishes"),
        ...index.incoming(n.id, "subscribes"),
      ]) {
        if ("channelId" in e.data && e.data.channelId === null) {
          add(
            "info",
            "edge.channel_unset",
            `${index.node(e.source)?.name} ${e.kind} to "${n.name}" without naming a channel.`,
            { edgeId: e.id },
          );
        }
      }
    }
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Siblings (same container, positions in the same frame) whose boxes intersect hide each other on the canvas. */
function checkOverlaps(doc: DesignDocument, add: Add) {
  const groups = new Map<string | null, DesignNode[]>();
  for (const n of doc.nodes) {
    const siblings = groups.get(n.parentId) ?? [];
    siblings.push(n);
    groups.set(n.parentId, siblings);
  }
  for (const siblings of groups.values()) {
    const boxes = siblings.map((n) => ({ n, ...n.position, ...nodeSize(n) }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        if (
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height
        ) {
          add(
            "warning",
            "layout.overlap",
            `"${a.n.name}" overlaps "${b.n.name}" on the canvas; move one of them (positions are relative to the container; \"${a.n.name}\" is ${a.width}×${a.height}).`,
            { nodeId: a.n.id },
          );
        }
      }
    }
  }
}
