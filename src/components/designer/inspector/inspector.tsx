"use client";

import { Trash2, X } from "lucide-react";

import { useCanvasActions } from "@/components/designer/canvas-actions";
import { EdgeForm } from "@/components/designer/inspector/edge-form";
import { NodeForm } from "@/components/designer/inspector/node-form";
import { KIND_STYLE } from "@/components/designer/nodes/kind-style";
import { useDesigner } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { NODE_KIND_META } from "@/lib/design/catalog";
import { NODE_KINDS } from "@/lib/design/schema";
import { useSelection } from "@/stores/selection-store";

/** Read-only greys out every control at once (a disabled fieldset disables all of them). */
function Content() {
  const readOnly = useDesigner((s) => s.readOnly);
  return (
    <fieldset disabled={readOnly} className="contents">
      <Editor />
    </fieldset>
  );
}

function Editor() {
  const nodeIds = useSelection((s) => s.nodeIds);
  const edgeIds = useSelection((s) => s.edgeIds);
  const document = useDesigner((s) => s.document);
  const actions = useCanvasActions();

  const total = nodeIds.length + edgeIds.length;
  if (total === 0) {
    return (
      <section className="grid gap-3 p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Components</h3>
          <span className="text-xs text-muted-foreground">{document.edges.length} connections</span>
        </div>
        <ul className="grid gap-1.5 text-sm">
          {NODE_KINDS.map((kind) => {
            const count = document.nodes.filter((n) => n.kind === kind).length;
            const Icon = KIND_STYLE[kind].icon;
            return (
              <li
                key={kind}
                className="flex items-center gap-2.5 rounded-xl border bg-card p-1.5 pr-2.5 shadow-xs"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg border bg-background">
                  <Icon className={`size-3.5 ${KIND_STYLE[kind].text}`} aria-hidden />
                </span>
                <span className="flex-1 font-medium">{NODE_KIND_META[kind].label}</span>
                <span className="rounded-md border bg-background px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
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
