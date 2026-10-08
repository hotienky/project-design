/**
 * Client state for one open project: the draft document, undo/redo history
 * (zundo, document only) and save bookkeeping. Pure zustand/vanilla so it is
 * unit-testable in Node; components read it through DesignerStoreProvider.
 *
 * Every action produces a new `document` object, which is what makes undo,
 * autosave (`document !== savedDocument`) and React re-renders work.
 */
import { temporal } from "zundo";
import { createStore } from "zustand/vanilla";

import { allowedEdgeKinds, NODE_KIND_META } from "@/lib/design/catalog";
import {
  removeChannel,
  removeField,
  removeOperation,
  renameField,
  scrubEntityRefs,
} from "@/lib/design/edits";
import { reparentNode, subtreeIds, type Point } from "@/lib/design/geometry";
import { newEdgeId, newNodeId } from "@/lib/design/ids";
import { safeParseDesign, sortNodesParentFirst } from "@/lib/design/integrity";
import {
  EdgeSchema,
  NodeSchema,
  type DesignDocument,
  type DesignEdge,
  type DesignNode,
  type EdgeKind,
  type NodeKind,
} from "@/lib/design/schema";

export type SaveStatus = "idle" | "saving" | "error" | "conflict";
type Sections = Pick<DesignDocument, "overview" | "stack" | "conventions" | "decisions">;

export interface DesignerState {
  slug: string;
  document: DesignDocument;
  /** The document object the server last accepted; dirty = document !== savedDocument. */
  savedDocument: DesignDocument;
  /** Server revision of savedDocument; sent with the next save. */
  revision: number;
  status: SaveStatus;
  statusMessage: string | null;

  addNode(kind: NodeKind, position: Point, parentId?: string | null): string;
  updateNode(id: string, update: (node: DesignNode) => DesignNode): void;
  /** Apply the result of a finished drag or resize (one undo step). */
  commitGeometry(
    changes: { id: string; position?: Point; size?: { width: number; height: number } }[],
  ): void;
  setParent(id: string, parentId: string | null): void;
  /** Returns the new edge id, or null if the connection is not allowed or exists. */
  connect(source: string, target: string, kind?: EdgeKind): string | null;
  updateEdge(id: string, update: (edge: DesignEdge) => DesignEdge): void;
  /** Removes nodes (with everything nested inside) and edges (plus edges of removed nodes). */
  removeElements(ids: { nodeIds?: string[]; edgeIds?: string[] }): void;
  updateSections(patch: Partial<Sections>): void;
  /** Cross-reference-safe edits (each is one undo step): see lib/design/edits.ts. */
  removeOperation(apiId: string, operationId: string): void;
  removeChannel(queueId: string, channelId: string): void;
  renameField(entityId: string, from: string, to: string): void;
  removeField(entityId: string, name: string): void;
  /** Replace the draft wholesale (restore a version, reload after a conflict). */
  replaceDocument(document: DesignDocument, revision?: number): void;

  markSaving(): void;
  markSaved(savedDocument: DesignDocument, revision: number): void;
  markSaveFailed(status: "error" | "conflict", message: string): void;
}

export type DesignerStore = ReturnType<typeof createDesignerStore>;

export function createDesignerStore(init: {
  slug: string;
  document: DesignDocument;
  revision: number;
  /**
   * Called when an edit would make the document invalid (schema or integrity errors).
   * The edit is discarded: the server would reject the save, so it must never be stored.
   */
  onReject?: (message: string) => void;
}) {
  return createStore<DesignerState>()(
    temporal(
      (set, get) => {
        const mutate = (fn: (doc: DesignDocument) => DesignDocument) => {
          const next = fn(get().document);
          if (next === get().document) return;
          const check = safeParseDesign(next);
          if (!check.ok) {
            init.onReject?.(check.issues[0]?.message ?? "That change is not valid");
            return;
          }
          set({ document: next });
        };
        const mapNode = (doc: DesignDocument, id: string, fn: (n: DesignNode) => DesignNode) => ({
          ...doc,
          nodes: doc.nodes.map((n) => (n.id === id ? fn(n) : n)),
        });

        return {
          slug: init.slug,
          document: init.document,
          savedDocument: init.document,
          revision: init.revision,
          status: "idle",
          statusMessage: null,

          addNode(kind, position, parentId = null) {
            const meta = NODE_KIND_META[kind];
            const node = NodeSchema.parse({
              id: newNodeId(kind),
              kind,
              name: `New ${meta.label.toLowerCase()}`,
              parentId,
              position,
              size: meta.container ? meta.defaultSize : null,
            });
            mutate((doc) => ({ ...doc, nodes: sortNodesParentFirst([...doc.nodes, node]) }));
            return node.id;
          },

          updateNode(id, update) {
            mutate((doc) => mapNode(doc, id, update));
          },

          commitGeometry(changes) {
            if (changes.length === 0) return;
            const byId = new Map(changes.map((c) => [c.id, c]));
            mutate((doc) => ({
              ...doc,
              nodes: doc.nodes.map((n) => {
                const c = byId.get(n.id);
                if (!c) return n;
                return { ...n, position: c.position ?? n.position, size: c.size ?? n.size };
              }),
            }));
          },

          setParent(id, parentId) {
            mutate((doc) => reparentNode(doc, id, parentId));
          },

          connect(source, target, kind) {
            const doc = get().document;
            const s = doc.nodes.find((n) => n.id === source);
            const t = doc.nodes.find((n) => n.id === target);
            if (!s || !t) return null;
            const allowed = allowedEdgeKinds(s.kind, t.kind);
            const chosen = kind ?? allowed[0];
            if (!chosen || !allowed.includes(chosen)) return null;
            if (source === target && chosen !== "relation") return null;
            const exists = doc.edges.some(
              (e) => e.kind === chosen && e.source === source && e.target === target,
            );
            if (exists) return null;
            const edge = EdgeSchema.parse({ id: newEdgeId(chosen), kind: chosen, source, target });
            mutate((d) => ({ ...d, edges: [...d.edges, edge] }));
            return edge.id;
          },

          updateEdge(id, update) {
            mutate((doc) => ({
              ...doc,
              edges: doc.edges.map((e) => (e.id === id ? update(e) : e)),
            }));
          },

          removeElements({ nodeIds = [], edgeIds = [] }) {
            mutate((doc) => {
              const doomed = new Set<string>();
              for (const id of nodeIds) for (const x of subtreeIds(doc, id)) doomed.add(x);
              const doomedEdges = new Set(edgeIds);
              if (doomed.size === 0 && doomedEdges.size === 0) return doc;
              const keepId = (id: string) => !doomed.has(id);
              const entities = new Set(
                doc.nodes.filter((n) => doomed.has(n.id) && n.kind === "entity").map((n) => n.id),
              );
              return scrubEntityRefs(
                {
                  ...doc,
                  nodes: doc.nodes.filter((n) => keepId(n.id)),
                  edges: doc.edges.filter(
                    (e) => !doomedEdges.has(e.id) && keepId(e.source) && keepId(e.target),
                  ),
                  // Scopes must not point at deleted nodes (integrity rule scope.unknown_node).
                  stack: doc.stack.map((s) => ({ ...s, scope: s.scope.filter(keepId) })),
                  conventions: doc.conventions.map((c) => ({
                    ...c,
                    scope: c.scope.filter(keepId),
                  })),
                },
                entities,
              );
            });
          },

          updateSections(patch) {
            mutate((doc) => ({ ...doc, ...patch }));
          },

          removeOperation(apiId, operationId) {
            mutate((doc) => removeOperation(doc, apiId, operationId));
          },
          removeChannel(queueId, channelId) {
            mutate((doc) => removeChannel(doc, queueId, channelId));
          },
          renameField(entityId, from, to) {
            mutate((doc) => renameField(doc, entityId, from, to));
          },
          removeField(entityId, name) {
            mutate((doc) => removeField(doc, entityId, name));
          },

          replaceDocument(document, revision) {
            set({
              document,
              savedDocument: document,
              revision: revision ?? get().revision,
              status: "idle",
              statusMessage: null,
            });
          },

          markSaving() {
            set({ status: "saving", statusMessage: null });
          },
          markSaved(savedDocument, revision) {
            set({ savedDocument, revision, status: "idle", statusMessage: null });
          },
          markSaveFailed(status, message) {
            set({ status, statusMessage: message });
          },
        };
      },
      {
        // History holds documents only; save bookkeeping is never undone.
        partialize: (s) => ({ document: s.document }),
        equality: (a, b) => a.document === b.document,
        limit: 200,
      },
    ),
  );
}

export const isDirty = (s: DesignerState) => s.document !== s.savedDocument;
