"use client";

import { Trash2 } from "lucide-react";

import { useCanvasActions } from "@/components/designer/canvas-actions";
import { EdgeForm } from "@/components/designer/inspector/edge-form";
import { NodeForm } from "@/components/designer/inspector/node-form";
import { useDesigner } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { NODE_KIND_META } from "@/lib/design/catalog";
import { NODE_KINDS } from "@/lib/design/schema";
import { useSelection } from "@/stores/selection-store";

function Content() {
  const nodeIds = useSelection((s) => s.nodeIds);
  const edgeIds = useSelection((s) => s.edgeIds);
  const document = useDesigner((s) => s.document);
  const actions = useCanvasActions();

  const total = nodeIds.length + edgeIds.length;
  if (total === 0) {
    return (
      <div className="grid gap-3 p-4">
        <p className="text-sm text-muted-foreground">Select a component to edit it.</p>
        <ul className="grid gap-1 text-sm">
          {NODE_KINDS.map((kind) => {
            const count = document.nodes.filter((n) => n.kind === kind).length;
            return (
              <li key={kind} className="flex justify-between">
                <span>{NODE_KIND_META[kind].label}</span>
                <span className="text-muted-foreground">{count}</span>
              </li>
            );
          })}
          <li className="flex justify-between border-t pt-1">
            <span>Connections</span>
            <span className="text-muted-foreground">{document.edges.length}</span>
          </li>
        </ul>
      </div>
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
export function Inspector({ wide }: { wide: boolean }) {
  const hasSelection = useSelection((s) => s.nodeIds.length + s.edgeIds.length > 0);
  if (wide) {
    return (
      <aside
        aria-label="Inspector"
        className="w-90 shrink-0 overflow-y-auto border-l bg-background"
      >
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
