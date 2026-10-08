/**
 * Structural rules a design must satisfy before it is stored. Anything here is
 * an "error": the save is rejected. Quality checks (warnings) live in validate.ts.
 */
import { canContain, EDGE_KIND_META } from "@/lib/design/catalog";
import {
  DesignDocumentSchema,
  type DesignDocument,
  type DesignNode,
  type Field,
  type TypeShape,
} from "@/lib/design/schema";

export interface Issue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export class DesignIntegrityError extends Error {
  constructor(readonly issues: Issue[]) {
    super(`Design has ${issues.length} integrity error(s): ${issues[0]?.message ?? ""}`);
    this.name = "DesignIntegrityError";
  }
}

export function checkIntegrity(doc: DesignDocument): Issue[] {
  const issues: Issue[] = [];
  const err = (code: string, message: string, ref: { nodeId?: string; edgeId?: string } = {}) =>
    issues.push({ severity: "error", code, message, ...ref });

  const nodes = new Map<string, DesignNode>();
  for (const n of doc.nodes) {
    if (nodes.has(n.id)) err("node.duplicate_id", `Duplicate node id "${n.id}"`, { nodeId: n.id });
    nodes.set(n.id, n);
  }

  for (const [section, items] of [
    ["stack", doc.stack],
    ["conventions", doc.conventions],
    ["decisions", doc.decisions],
  ] as const) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) err(`${section}.duplicate_id`, `Duplicate ${section} id "${item.id}"`);
      seen.add(item.id);
    }
  }
  for (const item of [...doc.stack, ...doc.conventions]) {
    for (const id of item.scope) {
      if (!nodes.has(id))
        err("scope.unknown_node", `"${item.id}" is scoped to unknown node "${id}"`);
    }
  }

  const checkEntityRef = (id: string | null, where: string, nodeId: string) => {
    if (id === null) return;
    if (nodes.get(id)?.kind !== "entity") {
      err("ref.not_entity", `${where} references "${id}", which is not an entity`, { nodeId });
    }
  };
  const checkFields = (fields: Field[], where: string, nodeId: string) => {
    const names = new Set<string>();
    for (const f of fields) {
      if (names.has(f.name))
        err("field.duplicate", `${where}: duplicate field "${f.name}"`, { nodeId });
      names.add(f.name);
      if (f.type === "enum" && f.enumValues.length === 0) {
        err("field.enum_without_values", `${where}.${f.name}: enum needs enumValues`, { nodeId });
      }
      if (f.type === "ref") {
        if (f.refEntityId === null) {
          err("field.ref_without_entity", `${where}.${f.name}: ref needs refEntityId`, { nodeId });
        } else checkEntityRef(f.refEntityId, `${where}.${f.name}`, nodeId);
      }
    }
  };
  const checkShape = (shape: TypeShape | null, where: string, nodeId: string) => {
    if (!shape) return;
    checkEntityRef(shape.entityId, where, nodeId);
    checkFields(shape.fields, where, nodeId);
  };

  for (const n of doc.nodes) {
    const ref = { nodeId: n.id };
    if (n.parentId !== null) {
      const parent = nodes.get(n.parentId);
      if (!parent)
        err("node.unknown_parent", `"${n.name}" has unknown parent "${n.parentId}"`, ref);
      else if (!canContain(parent.kind, n.kind)) {
        err("node.bad_parent", `A ${n.kind} cannot be placed inside a ${parent.kind}`, ref);
      }
    } else if (!canContain(null, n.kind)) {
      err("node.needs_parent", `A ${n.kind} must be placed inside a container`, ref);
    }

    switch (n.kind) {
      case "entity":
        checkFields(n.data.fields, n.name, n.id);
        for (const idx of n.data.indexes) {
          for (const f of idx.fields) {
            if (!n.data.fields.some((x) => x.name === f)) {
              err("entity.index_unknown_field", `${n.name}: index uses unknown field "${f}"`, ref);
            }
          }
        }
        break;
      case "api": {
        const opIds = new Set<string>();
        for (const op of n.data.operations) {
          if (opIds.has(op.id))
            err("api.duplicate_operation_id", `${n.name}: duplicate operation id "${op.id}"`, ref);
          opIds.add(op.id);
          checkShape(op.request, `${n.name}.${op.name}.request`, n.id);
          checkShape(op.response, `${n.name}.${op.name}.response`, n.id);
        }
        break;
      }
      case "queue": {
        const chIds = new Set<string>();
        for (const ch of n.data.channels) {
          if (chIds.has(ch.id))
            err("queue.duplicate_channel_id", `${n.name}: duplicate channel id "${ch.id}"`, ref);
          chIds.add(ch.id);
          checkShape(ch.payload, `${n.name}.${ch.name}`, n.id);
        }
        break;
      }
    }
  }

  // Parent chains must terminate (no cycles).
  for (const n of doc.nodes) {
    const seen = new Set<string>([n.id]);
    let cur = n.parentId;
    while (cur !== null) {
      if (seen.has(cur)) {
        err("node.parent_cycle", `"${n.name}" is inside itself`, { nodeId: n.id });
        break;
      }
      seen.add(cur);
      cur = nodes.get(cur)?.parentId ?? null;
    }
  }

  const edgeIds = new Set<string>();
  const edgeKeys = new Set<string>();
  for (const e of doc.edges) {
    const ref = { edgeId: e.id };
    if (edgeIds.has(e.id)) err("edge.duplicate_id", `Duplicate edge id "${e.id}"`, ref);
    edgeIds.add(e.id);
    const source = nodes.get(e.source);
    const target = nodes.get(e.target);
    if (!source || !target) {
      err("edge.unknown_endpoint", `Edge "${e.id}" points at a missing node`, ref);
      continue;
    }
    const meta = EDGE_KIND_META[e.kind];
    if (!meta.from.includes(source.kind) || !meta.to.includes(target.kind)) {
      err(
        "edge.bad_endpoints",
        `"${e.kind}" cannot connect a ${source.kind} to a ${target.kind}`,
        ref,
      );
    }
    if (e.source === e.target && e.kind !== "relation") {
      err("edge.self_loop", `"${source.name}" cannot ${meta.label} itself`, ref);
    }
    const key = `${e.kind}|${e.source}|${e.target}`;
    if (edgeKeys.has(key))
      err("edge.duplicate", `Duplicate ${e.kind} edge ${source.name} → ${target.name}`, ref);
    edgeKeys.add(key);

    if (e.kind === "calls" && target.kind === "api") {
      const ops = new Set(target.data.operations.map((o) => o.id));
      for (const op of e.data.operations) {
        if (!ops.has(op))
          err(
            "edge.unknown_operation",
            `${source.name} calls unknown operation "${op}" on ${target.name}`,
            ref,
          );
      }
    }
    if ((e.kind === "publishes" || e.kind === "subscribes") && e.data.channelId !== null) {
      if (target.kind === "queue" && !target.data.channels.some((c) => c.id === e.data.channelId)) {
        err(
          "edge.unknown_channel",
          `${source.name} ${e.kind} to unknown channel on ${target.name}`,
          ref,
        );
      }
    }
  }

  return issues;
}

/** Parents before children: React Flow requires it, and it keeps exports stable. */
export function sortNodesParentFirst(nodes: DesignNode[]): DesignNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = (n: DesignNode): number => {
    let d = 0;
    let cur = n.parentId;
    while (cur !== null && d <= nodes.length) {
      d++;
      cur = byId.get(cur)?.parentId ?? null;
    }
    return d;
  };
  return nodes
    .map((n, i) => ({ n, i, d: depth(n) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.n);
}

export type ParseResult = { ok: true; document: DesignDocument } | { ok: false; issues: Issue[] };

/** Schema + integrity in one step. Use it for every document entering the system. */
export function safeParseDesign(input: unknown): ParseResult {
  const parsed = DesignDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        severity: "error",
        code: `schema.${i.code}`,
        message: `${i.path.join(".") || "(root)"}: ${i.message}`,
      })),
    };
  }
  const issues = checkIntegrity(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, document: { ...parsed.data, nodes: sortNodesParentFirst(parsed.data.nodes) } };
}

export function parseDesign(input: unknown): DesignDocument {
  const result = safeParseDesign(input);
  if (!result.ok) throw new DesignIntegrityError(result.issues);
  return result.document;
}
