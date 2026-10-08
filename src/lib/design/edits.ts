/**
 * Document edits that touch several places at once, so the result stays valid
 * (no dangling operation, channel, field or entity references). Pure and
 * isomorphic; the designer store applies them as single undo steps.
 */
import type { DesignDocument, DesignNode, Field, TypeShape } from "@/lib/design/schema";

const mapNode = (doc: DesignDocument, id: string, fn: (n: DesignNode) => DesignNode) => ({
  ...doc,
  nodes: doc.nodes.map((n) => (n.id === id ? fn(n) : n)),
});

/** Removes an API operation and the `calls` edges' references to it. */
export function removeOperation(doc: DesignDocument, apiId: string, opId: string): DesignDocument {
  const next = mapNode(doc, apiId, (n) =>
    n.kind === "api"
      ? { ...n, data: { ...n.data, operations: n.data.operations.filter((o) => o.id !== opId) } }
      : n,
  );
  return {
    ...next,
    edges: next.edges.map((e) =>
      e.kind === "calls" && e.target === apiId && e.data.operations.includes(opId)
        ? { ...e, data: { ...e.data, operations: e.data.operations.filter((o) => o !== opId) } }
        : e,
    ),
  };
}

/** Removes a queue channel; publishes/subscribes edges that named it become "any channel". */
export function removeChannel(
  doc: DesignDocument,
  queueId: string,
  channelId: string,
): DesignDocument {
  const next = mapNode(doc, queueId, (n) =>
    n.kind === "queue"
      ? { ...n, data: { ...n.data, channels: n.data.channels.filter((c) => c.id !== channelId) } }
      : n,
  );
  return {
    ...next,
    edges: next.edges.map((e) =>
      (e.kind === "publishes" || e.kind === "subscribes") &&
      e.target === queueId &&
      e.data.channelId === channelId
        ? { ...e, data: { ...e.data, channelId: null } }
        : e,
    ),
  };
}

/** Renames an entity field and the indexes that use it. */
export function renameField(
  doc: DesignDocument,
  entityId: string,
  from: string,
  to: string,
): DesignDocument {
  return mapNode(doc, entityId, (n) =>
    n.kind === "entity"
      ? {
          ...n,
          data: {
            ...n.data,
            fields: n.data.fields.map((f) => (f.name === from ? { ...f, name: to } : f)),
            indexes: n.data.indexes.map((i) => ({
              ...i,
              fields: i.fields.map((f) => (f === from ? to : f)),
            })),
          },
        }
      : n,
  );
}

/** Removes an entity field, dropping it from indexes (an index left empty is removed). */
export function removeField(doc: DesignDocument, entityId: string, name: string): DesignDocument {
  return mapNode(doc, entityId, (n) =>
    n.kind === "entity"
      ? {
          ...n,
          data: {
            ...n.data,
            fields: n.data.fields.filter((f) => f.name !== name),
            indexes: n.data.indexes
              .map((i) => ({ ...i, fields: i.fields.filter((f) => f !== name) }))
              .filter((i) => i.fields.length > 0),
          },
        }
      : n,
  );
}

/**
 * Clears references to entities that are about to disappear: shapes lose their
 * entity, and `ref` fields become plain `json` (a ref without an entity is invalid).
 */
export function scrubEntityRefs(doc: DesignDocument, gone: ReadonlySet<string>): DesignDocument {
  if (gone.size === 0) return doc;
  const field = (f: Field): Field =>
    f.refEntityId && gone.has(f.refEntityId) ? { ...f, type: "json", refEntityId: null } : f;
  const shape = (s: TypeShape | null): TypeShape | null =>
    s && {
      ...s,
      entityId: s.entityId && gone.has(s.entityId) ? null : s.entityId,
      fields: s.fields.map(field),
    };
  return {
    ...doc,
    nodes: doc.nodes.map((n) => {
      switch (n.kind) {
        case "entity":
          return { ...n, data: { ...n.data, fields: n.data.fields.map(field) } };
        case "api":
          return {
            ...n,
            data: {
              ...n.data,
              operations: n.data.operations.map((o) => ({
                ...o,
                request: shape(o.request),
                response: shape(o.response),
              })),
            },
          };
        case "queue":
          return {
            ...n,
            data: {
              ...n.data,
              channels: n.data.channels.map((c) => ({ ...c, payload: shape(c.payload)! })),
            },
          };
        default:
          return n;
      }
    }),
  };
}
