"use client";

import { ChevronRight, Trash2, X } from "lucide-react";
import { useState } from "react";

import { useCanvasActions } from "@/components/designer/canvas-actions";
import { EdgeForm } from "@/components/designer/inspector/edge-form";
import { NodeForm } from "@/components/designer/inspector/node-form";
import { KIND_STYLE } from "@/components/designer/nodes/kind-style";
import { useDesigner } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { NODE_KIND_META } from "@/lib/design/catalog";
import { NODE_KINDS, type NodeKind } from "@/lib/design/schema";
import { useSelection } from "@/stores/selection-store";

/** Read-only greys out every control at once (a disabled fieldset disables all of them). */
function Content() {
  const readOnly = useDesigner((s) => s.readOnly);
  const hasSelection = useSelection((s) => s.nodeIds.length + s.edgeIds.length > 0);
  // Browsing the component list stays available in read-only mode.
  if (!hasSelection) return <ComponentList />;
  return (
    <fieldset disabled={readOnly} className="contents">
      <Editor />
    </fieldset>
  );
}

/** Nothing selected: node counts per kind; a kind expands to its nodes, a node is selected and centred. */
function ComponentList() {
  const document = useDesigner((s) => s.document);
  const actions = useCanvasActions();
  const [open, setOpen] = useState<ReadonlySet<NodeKind>>(new Set());

  function toggle(kind: NodeKind) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(kind)) next.add(kind);
      return next;
    });
  }

  function select(nodeId: string) {
    useSelection.getState().set([nodeId], []);
    actions.focus({ nodeId });
  }

  return (
    <section className="grid gap-3 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Components</h3>
        <span className="text-xs text-muted-foreground">{document.edges.length} connections</span>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {NODE_KINDS.map((kind) => {
          const nodes = document.nodes
            .filter((n) => n.kind === kind)
            .sort((a, b) => a.name.localeCompare(b.name));
          const expanded = open.has(kind) && nodes.length > 0;
          const Icon = KIND_STYLE[kind].icon;
          return (
            <li key={kind} className="rounded-xl border bg-card shadow-xs">
              <button
                type="button"
                disabled={nodes.length === 0}
                aria-expanded={expanded}
                onClick={() => toggle(kind)}
                className="flex w-full items-center gap-2.5 rounded-xl p-1.5 pr-2.5 text-left outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg border bg-background">
                  <Icon className={`size-3.5 ${KIND_STYLE[kind].text}`} aria-hidden />
                </span>
                <span className="flex-1 font-medium">{NODE_KIND_META[kind].label}</span>
                <span className="rounded-md border bg-background px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {nodes.length}
                </span>
                <ChevronRight
                  aria-hidden
                  className={`size-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""} ${nodes.length === 0 ? "invisible" : ""}`}
                />
              </button>
              {expanded && (
                <ul className="grid gap-0.5 border-t p-1">
                  {nodes.map((node) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => select(node.id)}
                        className="w-full truncate rounded-lg px-2 py-1 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        {node.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Editor() {
  const nodeIds = useSelection((s) => s.nodeIds);
  const edgeIds = useSelection((s) => s.edgeIds);
  const document = useDesigner((s) => s.document);
  const actions = useCanvasActions();

  const total = nodeIds.length + edgeIds.length;
  if (total > 1) {
    return (
      <div className="grid gap-3 p-4">
        <p className="text-sm">{total} selected</p>
        <Button variant="destructive" size="sm" onClick={() => actions.deleteSelection()}>
          <Trash2 /> Delete selection
        </Button>
      </div>
    );
  }
  const node = nodeIds[0] ? document.nodes.find((n) => n.id === nodeIds[0]) : undefined;
  if (node) {
    return (
      <>
        <NodeForm key={node.id} node={node} />
        <div className="border-t p-4">
          <Button variant="destructive" size="sm" onClick={() => actions.deleteSelection()}>
            <Trash2 /> Delete {NODE_KIND_META[node.kind].label.toLowerCase()}
          </Button>
        </div>
      </>
    );
  }
  const edge = edgeIds[0] ? document.edges.find((e) => e.id === edgeIds[0]) : undefined;
  if (edge) {
    return (
      <>
        <EdgeForm key={edge.id} edge={edge} />
        <div className="border-t p-4">
          <Button variant="destructive" size="sm" onClick={() => actions.deleteSelection()}>
            <Trash2 /> Delete connection
          </Button>
        </div>
      </>
    );
  }
  return null;
}

/** The right-hand editor: a fixed column on wide screens, a sheet below 1280 px. */
function Header() {
  const nodeIds = useSelection((s) => s.nodeIds);
  const edgeIds = useSelection((s) => s.edgeIds);
  const kind = useDesigner((s) =>
    nodeIds.length === 1 && edgeIds.length === 0
      ? s.document.nodes.find((n) => n.id === nodeIds[0])?.kind
      : undefined,
  );
  const total = nodeIds.length + edgeIds.length;
  const subtitle =
    total === 0
      ? "Select a component to edit it."
      : total > 1
        ? `${total} selected`
        : kind
          ? `Editing ${NODE_KIND_META[kind].label.toLowerCase()}`
          : "Editing connection";
  return (
    <header className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b bg-background px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">Inspector</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {total > 0 && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Clear selection"
          onClick={() => useSelection.getState().clear()}
        >
          <X />
        </Button>
      )}
    </header>
  );
}

export function Inspector({ wide }: { wide: boolean }) {
  const hasSelection = useSelection((s) => s.nodeIds.length + s.edgeIds.length > 0);
  if (wide) {
    return (
      <aside
        aria-label="Inspector"
        className="w-90 shrink-0 overflow-y-auto border-l bg-background"
      >
        <Header />
        <Content />
      </aside>
    );
  }
  return (
    <Sheet open={hasSelection} onOpenChange={(open) => !open && useSelection.getState().clear()}>
      <SheetContent side="right" className="w-90 gap-0 overflow-y-auto p-0 sm:max-w-sm">
        <SheetTitle className="sr-only">Inspector</SheetTitle>
        <SheetDescription className="sr-only">
          Edit the selected component or connection.
        </SheetDescription>
        <Content />
      </SheetContent>
    </Sheet>
  );
}
