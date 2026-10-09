"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeSelectionChange,
  type NodeChange,
  type NodeSelectionChange,
  type Viewport,
} from "@xyflow/react";
import { Lock } from "lucide-react";
import { useTheme } from "next-themes";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from "react";
import { toast } from "sonner";

import { CanvasActionsProvider, type CanvasActions } from "@/components/designer/canvas-actions";
import { EdgeKindMenu, type EdgeKindMenuState } from "@/components/designer/edge-kind-menu";
import { edgeTypes } from "@/components/designer/edges/design-edge";
import { EndpointsPanel } from "@/components/designer/endpoints-panel";
import { Inspector } from "@/components/designer/inspector/inspector";
import { LevelBreadcrumb } from "@/components/designer/level-breadcrumb";
import { KIND_STYLE } from "@/components/designer/nodes/kind-style";
import { nodeTypes } from "@/components/designer/nodes";
import { DRAG_MIME, Palette } from "@/components/designer/palette";
import {
  useDesigner,
  useDesignerStore,
  useProjectMeta,
} from "@/components/designer/store-provider";
import {
  keepMeasured,
  toFlowEdges,
  toFlowNodes,
  type FlowEdge,
  type FlowNode,
} from "@/components/designer/to-flow";
import { Toolbar } from "@/components/designer/toolbar";
import { useStatuses } from "@/components/designer/use-statuses";
import { ValidationPanel } from "@/components/designer/validation-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { allowedEdgeKinds, canContain, NODE_KIND_META } from "@/lib/design/catalog";
import {
  absolutePosition,
  absoluteRect,
  findContainerFor,
  findDropParent,
  subtreeIds,
  type Point,
} from "@/lib/design/geometry";
import { isFocusable, levelOf, levelView, type LevelView } from "@/lib/design/levels";
import { NODE_KINDS, type EdgeKind, type NodeKind } from "@/lib/design/schema";
import { useCanvasUi } from "@/stores/canvas-ui-store";
import { useSelection } from "@/stores/selection-store";
import { useStatusStore } from "@/stores/status-store";

const SNAP: [number, number] = [8, 8];
const NONE: ReadonlySet<string> = new Set();

const subscribeNever = () => () => {};
/** false during SSR and hydration, true afterwards: React Flow measures the DOM, so it renders client-side only. */
const useMounted = () =>
  useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

const viewportKey = (slug: string) => `pd:viewport:${slug}`;
function readViewport(slug: string): Viewport | null {
  try {
    const raw = window.localStorage.getItem(viewportKey(slug));
    const v = raw ? (JSON.parse(raw) as Viewport) : null;
    return v && [v.x, v.y, v.zoom].every(Number.isFinite) ? v : null;
  } catch {
    return null;
  }
}

/** The levels view for the current UI state, or undefined in the "all" view. */
function viewFor(
  doc: Parameters<typeof levelView>[0],
  ui: { viewMode: string; focusId: string | null },
): LevelView | undefined {
  return ui.viewMode === "levels" ? levelView(doc, ui.focusId) : undefined;
}

function useIsWide() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(min-width: 1280px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(min-width: 1280px)").matches,
    () => true,
  );
}

function Flow({ wide }: { wide: boolean }) {
  const store = useDesignerStore();
  const { slug } = useProjectMeta();
  const { resolvedTheme } = useTheme();
  const rf = useReactFlow<FlowNode, FlowEdge>();
  const statuses = useStatuses(slug);
  const minimapOpen = useCanvasUi((s) => s.minimapOpen);
  const validationOpen = useCanvasUi((s) => s.validationOpen);
  const document = useDesigner((s) => s.document);
  const readOnly = useDesigner((s) => s.readOnly);
  const viewMode = useCanvasUi((s) => s.viewMode);
  const focusId = useCanvasUi((s) => s.focusId);
  const view = useMemo(
    () => viewFor(document, { viewMode, focusId }),
    [document, viewMode, focusId],
  );

  const wrapper = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [menu, setMenu] = useState<EdgeKindMenuState | null>(null);
  const [confirm, setConfirm] = useState<{
    message: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [savedViewport] = useState(() => readViewport(slug));

  const [initial] = useState(() => {
    const doc = store.getState().document;
    const v = viewFor(doc, useCanvasUi.getState());
    return { nodes: toFlowNodes(doc, {}, NONE, v), edges: toFlowEdges(doc, NONE, v) };
  });
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initial.edges);

  // Store → canvas: rebuild when the document or statuses change.
  useEffect(() => {
    const selection = useSelection.getState();
    setNodes((previous) => keepMeasured(toFlowNodes(document, statuses, NONE, view), previous));
    setEdges(toFlowEdges(document, NONE, view));
    // Selection ids that no longer exist must not linger in the inspector.
    const ids = new Set(document.nodes.map((n) => n.id));
    const edgeIds = new Set(document.edges.map((e) => e.id));
    useSelection.getState().set(
      selection.nodeIds.filter((id) => ids.has(id)),
      selection.edgeIds.filter((id) => edgeIds.has(id)),
    );
  }, [document, statuses, view, setNodes, setEdges]);

  // Changing level frames the new view; going back to "all" restores its saved viewport.
  const viewKey = view ? `levels:${view.focus?.id ?? ""}` : "all";
  const shownViewKey = useRef(viewKey);
  /** Set by focus() when it centres a node itself right after switching level. */
  const skipFit = useRef(false);
  useEffect(() => {
    if (shownViewKey.current === viewKey) return;
    shownViewKey.current = viewKey;
    if (skipFit.current) {
      skipFit.current = false;
      return;
    }
    // Wait a frame so React Flow has measured the new nodes.
    const timer = window.setTimeout(() => {
      const saved = viewKey === "all" ? readViewport(slug) : null;
      if (saved) void rf.setViewport(saved, { duration: 200 });
      else void rf.fitView({ duration: 200, padding: 0.15, maxZoom: 1.25 });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [viewKey, rf, slug]);

  // The selection store is the single source of truth: React Flow only ever sees `selected`
  // derived from it, and user clicks come back through onNodesChange/onEdgesChange "select"
  // changes. (Mirroring RF's own selection into the store made the two chase each other.)
  const selectedNodeIds = useSelection((s) => s.nodeIds);
  const selectedEdgeIds = useSelection((s) => s.edgeIds);
  const shownNodes = useMemo(() => {
    const selected = new Set(selectedNodeIds);
    return nodes.map((n) =>
      !!n.selected === selected.has(n.id) ? n : { ...n, selected: selected.has(n.id) },
    );
  }, [nodes, selectedNodeIds]);
  const shownEdges = useMemo(() => {
    const selected = new Set(selectedEdgeIds);
    return edges.map((e) =>
      !!e.selected === selected.has(e.id) ? e : { ...e, selected: selected.has(e.id) },
    );
  }, [edges, selectedEdgeIds]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const picks = changes.filter((c): c is NodeSelectionChange => c.type === "select");
      if (picks.length > 0) {
        const current = useSelection.getState();
        const next = new Set(current.nodeIds);
        for (const c of picks) {
          if (c.selected) next.add(c.id);
          else next.delete(c.id);
        }
        current.set([...next], current.edgeIds);
      }
      const rest = changes.filter((c) => c.type !== "select");
      if (rest.length > 0) onNodesChange(rest);
    },
    [onNodesChange],
  );
  const handleEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      const picks = changes.filter((c): c is EdgeSelectionChange => c.type === "select");
      if (picks.length > 0) {
        const current = useSelection.getState();
        const next = new Set(current.edgeIds);
        for (const c of picks) {
          if (c.selected) next.add(c.id);
          else next.delete(c.id);
        }
        current.set(current.nodeIds, [...next]);
      }
      const rest = changes.filter((c) => c.type !== "select");
      if (rest.length > 0) onEdgesChange(rest);
    },
    [onEdgesChange],
  );

  // ── Dragging ────────────────────────────────────────────────────────────
  const resetFromStore = useCallback(() => {
    const doc = store.getState().document;
    const sel = useSelection.getState();
    setNodes((prev) =>
      keepMeasured(
        toFlowNodes(
          doc,
          useStatusStore.getState().statuses,
          new Set(sel.nodeIds),
          viewFor(doc, useCanvasUi.getState()),
        ),
        prev,
      ),
    );
  }, [store, setNodes]);

  const onNodeDragStop = useCallback(
    (_event: unknown, node: FlowNode, dragged: FlowNode[]) => {
      const state = store.getState();
      state.commitGeometry(
        dragged.map((n) => ({
          id: n.id,
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        })),
      );
      const doc = store.getState().document;
      const current = doc.nodes.find((n) => n.id === node.id);
      if (!current) return;
      const v = viewFor(doc, useCanvasUi.getState());
      // At project level containers are collapsed, so nothing can be dropped into them.
      if (v && !v.focus) return;
      const rect = absoluteRect(doc, node.id);
      let target = findDropParent(doc, node.id, {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      });
      if (v?.focus) {
        // Inside a container the drop stays inside it: dropped anywhere else, the node goes to
        // the focused container itself.
        if (target === null || !subtreeIds(doc, v.focus.id).has(target)) target = v.focus.id;
        if (target === current.parentId) return;
        if (!canContain(doc.nodes.find((n) => n.id === target)!.kind, current.kind)) {
          toast.error(`A ${NODE_KIND_META[current.kind].label.toLowerCase()} can't go there`);
          resetFromStore();
          return;
        }
        state.setParent(node.id, target);
        return;
      }
      if (target === current.parentId) return;
      if (target === null && !canContain(null, current.kind)) {
        toast.error(
          `A ${NODE_KIND_META[current.kind].label.toLowerCase()} must sit inside a service`,
        );
        resetFromStore();
        return;
      }
      state.setParent(node.id, target);
    },
    [store, resetFromStore],
  );

  // ── Deleting ────────────────────────────────────────────────────────────
  const onBeforeDelete = useCallback(
    async ({ nodes: doomed, edges: doomedEdges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
      const doc = store.getState().document;
      const roots = doomed.filter((n) => !doomed.some((o) => o.id === n.parentId));
      const total = new Set(roots.flatMap((n) => [...subtreeIds(doc, n.id)]));
      const nested = total.size - roots.length;
      if (nested === 0) return doomed.length > 0 || doomedEdges.length > 0;
      const first = roots[0]!.data.node.name;
      const subject = roots.length === 1 ? first : `${roots.length} components`;
      const ok = await new Promise<boolean>((resolve) =>
        setConfirm({
          message: `Delete ${subject} and its ${nested} nested component${nested === 1 ? "" : "s"}?`,
          resolve,
        }),
      );
      return ok;
    },
    [store],
  );

  const onDelete = useCallback(
    ({ nodes: gone, edges: goneEdges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
      store.getState().removeElements({
        nodeIds: gone.map((n) => n.id),
        edgeIds: goneEdges.map((e) => e.id),
      });
      useSelection.getState().clear();
    },
    [store],
  );

  // ── Connecting ──────────────────────────────────────────────────────────
  const kindOf = useCallback(
    (id: string) => store.getState().document.nodes.find((n) => n.id === id)?.kind,
    [store],
  );
  const kindsFor = useCallback(
    (source: string, target: string): EdgeKind[] => {
      const s = kindOf(source);
      const t = kindOf(target);
      if (!s || !t) return [];
      const kinds = allowedEdgeKinds(s, t);
      return source === target ? kinds.filter((k) => k === "relation") : kinds;
    },
    [kindOf],
  );

  const finishConnect = useCallback(
    (source: string, target: string, kind?: EdgeKind) => {
      const id = store.getState().connect(source, target, kind);
      if (id === null) toast.info("Already connected");
      else useSelection.getState().set([], [id]);
    },
    [store],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const kinds = kindsFor(c.source, c.target);
      const from = kindOf(c.source);
      const to = kindOf(c.target);
      if (kinds.length === 0) {
        if (from && to)
          toast.error(
            `A ${NODE_KIND_META[from].label} can't connect to a ${NODE_KIND_META[to].label}`,
          );
        return;
      }
      if (kinds.length === 1) return finishConnect(c.source, c.target, kinds[0]);
      const box = wrapper.current?.getBoundingClientRect();
      setMenu({
        x: pointer.current.x - (box?.left ?? 0),
        y: pointer.current.y - (box?.top ?? 0),
        source: c.source,
        target: c.target,
        kinds,
      });
    },
    [kindsFor, kindOf, finishConnect],
  );

  // ── Adding ──────────────────────────────────────────────────────────────
  /** Flow-space point → document (absolute) coordinates: they differ inside a level. */
  const toAbsolute = useCallback(
    (p: Point): Point => {
      const v = viewFor(store.getState().document, useCanvasUi.getState());
      return v ? { x: p.x + v.origin.x, y: p.y + v.origin.y } : p;
    },
    [store],
  );

  /** `center` is in document (absolute) coordinates. */
  const addNodeAt = useCallback(
    (kind: NodeKind, center: Point, forcedParent?: string | null) => {
      const meta = NODE_KIND_META[kind];
      const doc = store.getState().document;
      const ui = useCanvasUi.getState();
      const v = viewFor(doc, ui);
      if (v?.focus?.kind === "module") {
        toast.error("Go up a level to add components");
        return;
      }
      let parentId: string | null;
      if (forcedParent !== undefined) parentId = forcedParent;
      else if (v && !v.focus)
        parentId = null; // project level: containers are collapsed
      else {
        parentId = findContainerFor(doc, kind, center);
        if (v?.focus && (parentId === null || !subtreeIds(doc, v.focus.id).has(parentId)))
          parentId = v.focus.id;
      }
      if (
        !canContain(
          parentId ? (doc.nodes.find((n) => n.id === parentId)?.kind ?? null) : null,
          kind,
        )
      ) {
        const parents = meta.parents
          .filter((p): p is NodeKind => p !== null)
          .map((p) => NODE_KIND_META[p].label.toLowerCase());
        toast.error(
          `A ${meta.label.toLowerCase()} must be dropped inside a ${parents.join(" or ")}`,
        );
        return;
      }
      const topLeft = {
        x: Math.round((center.x - meta.defaultSize.width / 2) / 8) * 8,
        y: Math.round((center.y - meta.defaultSize.height / 2) / 8) * 8,
      };
      const origin = parentId ? absolutePosition(doc, parentId) : { x: 0, y: 0 };
      const id = store
        .getState()
        .addNode(kind, { x: topLeft.x - origin.x, y: topLeft.y - origin.y }, parentId);
      useSelection.getState().set([id], []);
      useSelection.getState().requestNameFocus(id);
      // Drill into the parent when the new node would be hidden in the current level.
      if (v && parentId && !(v.focus && subtreeIds(doc, v.focus.id).has(parentId)))
        ui.setFocus(parentId);
    },
    [store],
  );

  const addNodeAtCenter = useCallback(
    (kind: NodeKind) => {
      const box = wrapper.current?.getBoundingClientRect();
      if (!box) return;
      const center = toAbsolute(
        rf.screenToFlowPosition({
          x: box.left + box.width / 2,
          y: box.top + box.height / 2,
        }),
      );
      const doc = store.getState().document;
      const v = viewFor(doc, useCanvasUi.getState());
      if (!canContain(null, kind)) {
        // Layers and modules go inside the selected service/layer.
        const selected = useSelection.getState().nodeIds;
        const parent =
          selected.length === 1 ? doc.nodes.find((n) => n.id === selected[0]) : undefined;
        if (!parent || !canContain(parent.kind, kind)) {
          // Inside a level, the focused container takes it.
          if (v?.focus && v.focus.kind !== "module") return addNodeAt(kind, center);
          toast.error(
            `Select a ${NODE_KIND_META[kind].parents.filter(Boolean).join(" or ")} first`,
          );
          return;
        }
        const siblings = doc.nodes.filter((n) => n.parentId === parent.id).length;
        const rect = absoluteRect(doc, parent.id);
        const offset = 24 + (siblings % 6) * 16;
        return addNodeAt(
          kind,
          {
            x: rect.x + offset + NODE_KIND_META[kind].defaultSize.width / 2,
            y: rect.y + 32 + offset + NODE_KIND_META[kind].defaultSize.height / 2,
          },
          parent.id,
        );
      }
      addNodeAt(kind, center, v?.focus ? undefined : null);
    },
    [rf, store, addNodeAt, toAbsolute],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      const kind = event.dataTransfer.getData(DRAG_MIME) as NodeKind;
      if (!NODE_KINDS.includes(kind) || store.getState().readOnly) return;
      event.preventDefault();
      addNodeAt(kind, toAbsolute(rf.screenToFlowPosition({ x: event.clientX, y: event.clientY })));
    },
    [rf, store, addNodeAt, toAbsolute],
  );

  // ── Actions exposed to the palette, inspector and validation panel ────────
  const focus = useCallback(
    ({ nodeId, edgeId }: { nodeId?: string; edgeId?: string }) => {
      const doc = store.getState().document;
      const ui = useCanvasUi.getState();
      if (ui.viewMode === "levels") {
        const edge = edgeId ? doc.edges.find((e) => e.id === edgeId) : undefined;
        const wanted = nodeId ? [nodeId] : edge ? [edge.source, edge.target] : [];
        if (!wanted.every((id) => doc.nodes.some((n) => n.id === id)) || wanted.length === 0)
          return;
        const v = viewFor(doc, ui)!;
        const shown = (id: string) =>
          v.inside.some((i) => i.node.id === id) || v.context.some((c) => c.node.id === id);
        if (!wanted.every(shown)) {
          skipFit.current = true;
          ui.setFocus(levelOf(doc, wanted[0]!));
        }
        // Centre on what React Flow actually drew once the level has rendered.
        window.setTimeout(() => {
          const boxes = wanted
            .map((id) => rf.getInternalNode(id))
            .filter((n) => n !== undefined)
            .map((n) => ({
              x: n.internals.positionAbsolute.x + (n.measured.width ?? 0) / 2,
              y: n.internals.positionAbsolute.y + (n.measured.height ?? 0) / 2,
            }));
          if (boxes.length === 0) return;
          const x = boxes.reduce((t, b) => t + b.x, 0) / boxes.length;
          const y = boxes.reduce((t, b) => t + b.y, 0) / boxes.length;
          void rf.setCenter(x, y, { zoom: Math.max(rf.getZoom(), 1), duration: 300 });
        }, 50);
        return;
      }
      let point: { x: number; y: number } | null = null;
      if (nodeId && doc.nodes.some((n) => n.id === nodeId)) {
        const r = absoluteRect(doc, nodeId);
        point = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      } else if (edgeId) {
        const edge = doc.edges.find((e) => e.id === edgeId);
        if (edge) {
          const a = absoluteRect(doc, edge.source);
          const b = absoluteRect(doc, edge.target);
          point = {
            x: (a.x + a.width / 2 + b.x + b.width / 2) / 2,
            y: (a.y + a.height / 2 + b.y + b.height / 2) / 2,
          };
        }
      }
      if (point)
        void rf.setCenter(point.x, point.y, { zoom: Math.max(rf.getZoom(), 1), duration: 300 });
    },
    [rf, store],
  );

  const current: CanvasActions = {
    addNodeAtCenter,
    addNodeAt: (kind, center) => addNodeAt(kind, toAbsolute(center)),
    focus,
    deleteSelection: () => {
      const sel = useSelection.getState();
      void rf.deleteElements({
        nodes: sel.nodeIds.map((id) => ({ id })),
        edges: sel.edgeIds.map((id) => ({ id })),
      });
    },
    fitView: () => void rf.fitView({ duration: 200, padding: 0.15 }),
    tidyLayout: () => {
      const v = viewFor(store.getState().document, useCanvasUi.getState());
      if (v?.focus?.kind === "module") return;
      store.getState().arrangeLayout(v?.focus?.id ?? null, { collapsed: !!v && !v.focus });
      // Wait a frame so React Flow has the new positions before framing them.
      window.setTimeout(() => void rf.fitView({ duration: 300, padding: 0.15 }), 50);
    },
  };
  const actions = useRef(current);
  useEffect(() => {
    actions.current = current;
  });

  return (
    <CanvasActionsProvider actionsRef={actions}>
      <div className="flex min-h-0 min-w-0 flex-1">
        {!readOnly && <Palette />}
        <div
          ref={wrapper}
          className="relative min-w-0 flex-1"
          onPointerMove={(e) => (pointer.current = { x: e.clientX, y: e.clientY })}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DRAG_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={onDrop}
        >
          <ReactFlow<FlowNode, FlowEdge>
            nodes={shownNodes}
            edges={shownEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            zIndexMode="manual"
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeDoubleClick={(_, node) => {
              const n = node.data.node;
              // Drill into containers and modules; a context node opens the level that shows it.
              if (isFocusable(n)) useCanvasUi.getState().setFocus(n.id);
              else if (node.data.context !== undefined)
                useCanvasUi.getState().setFocus(levelOf(store.getState().document, n.id));
            }}
            onBeforeDelete={onBeforeDelete}
            onDelete={onDelete}
            onConnect={onConnect}
            onConnectEnd={(_, state) => {
              if (state.toNode && state.isValid === false && state.fromNode) {
                const from = kindOf(state.fromNode.id);
                const to = kindOf(state.toNode.id);
                if (from && to)
                  toast.error(
                    `A ${NODE_KIND_META[from].label} can't connect to a ${NODE_KIND_META[to].label}`,
                  );
              }
            }}
            isValidConnection={(c) => kindsFor(c.source, c.target).length > 0}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={40}
            snapToGrid
            snapGrid={SNAP}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
            multiSelectionKeyCode="Shift"
            defaultViewport={(!view && savedViewport) || undefined}
            fitView={!!view || !savedViewport}
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            onMoveEnd={(_, viewport) => {
              // Only the "all" view keeps its viewport; levels are framed when opened.
              if (useCanvasUi.getState().viewMode !== "all") return;
              try {
                window.localStorage.setItem(viewportKey(slug), JSON.stringify(viewport));
              } catch {
                // Storage unavailable (private window): the viewport just isn't remembered.
              }
            }}
            colorMode={resolvedTheme === "dark" ? "dark" : "light"}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
            {minimapOpen && (
              <MiniMap<FlowNode>
                pannable
                zoomable
                nodeColor={(n) => KIND_STYLE[n.data.node.kind]?.hex ?? "#888"}
              />
            )}
            <Controls position="top-right" showInteractive={false} />
            <Panel position="top-left" className="flex items-center gap-2">
              <Toolbar />
              {readOnly && (
                <span className="flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium text-muted-foreground shadow-xs">
                  <Lock className="size-3.5" aria-hidden />
                  Read-only
                </span>
              )}
              {view && <LevelBreadcrumb focusId={view.focus?.id ?? null} />}
            </Panel>
            {view?.focus?.kind === "module" && (
              <Panel position="top-right" className="mr-14!">
                <EndpointsPanel focus={view.focus} />
              </Panel>
            )}
            {validationOpen && (
              <Panel position="bottom-left">
                <ValidationPanel />
              </Panel>
            )}
          </ReactFlow>
          {menu && (
            <EdgeKindMenu
              menu={menu}
              onClose={() => setMenu(null)}
              onPick={(kind) => {
                finishConnect(menu.source, menu.target, kind);
                setMenu(null);
              }}
            />
          )}
        </div>
        <Inspector wide={wide} />
      </div>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && confirm) {
            confirm.resolve(false);
            setConfirm(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete components?</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.message} You can undo this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                confirm?.resolve(true);
                setConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CanvasActionsProvider>
  );
}

export function DesignerCanvas() {
  const mounted = useMounted();
  const wide = useIsWide();
  if (!mounted) return <p className="p-8 text-muted-foreground">Loading canvas…</p>;
  return (
    <ReactFlowProvider>
      <Flow wide={wide} />
    </ReactFlowProvider>
  );
}
