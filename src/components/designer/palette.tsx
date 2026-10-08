"use client";

import { GripVertical } from "lucide-react";

import { useCanvasActions } from "@/components/designer/canvas-actions";
import { KIND_STYLE } from "@/components/designer/nodes/kind-style";
import { useDesigner } from "@/components/designer/store-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { canContain, NODE_KIND_META } from "@/lib/design/catalog";
import { NODE_KINDS, type NodeKind } from "@/lib/design/schema";
import { cn } from "@/lib/utils";
import { useSelection } from "@/stores/selection-store";

export const DRAG_MIME = "application/x-design-kind";

/** One button per node kind. Click to add at the centre, or drag onto the canvas. */
export function Palette() {
  const actions = useCanvasActions();
  const selectedId = useSelection((s) =>
    s.nodeIds.length === 1 && s.edgeIds.length === 0 ? s.nodeIds[0] : null,
  );
  const selectedKind = useDesigner(
    (s) => s.document.nodes.find((n) => n.id === selectedId)?.kind ?? null,
  );

  return (
    <aside
      aria-label="Palette"
      className="flex w-60 shrink-0 flex-col overflow-y-auto border-r bg-background"
    >
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Components</h2>
        <p className="text-xs text-muted-foreground">Drag onto the canvas, or click to add</p>
      </header>
      <div className="flex flex-col gap-1.5 p-3">
        {NODE_KINDS.map((kind: NodeKind) => {
          const meta = NODE_KIND_META[kind];
          const style = KIND_STYLE[kind];
          const Icon = style.icon;
          const needsParent = !canContain(null, kind);
          const disabled = needsParent && !(selectedKind && canContain(selectedKind, kind));
          const hint = disabled
            ? `Select a ${meta.parents.filter(Boolean).join(" or ")} first, or drop it onto one`
            : meta.description;
          return (
            <Tooltip key={kind}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  draggable
                  aria-label={`Add ${meta.label}`}
                  aria-disabled={disabled || undefined}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_MIME, kind);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => !disabled && actions.addNodeAtCenter(kind)}
                  className={cn(
                    "group flex w-full min-w-0 cursor-grab items-center gap-2.5 rounded-xl border bg-card p-2 text-left shadow-xs transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background">
                    <Icon className={cn("size-4", style.text)} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-tight font-semibold">
                      {meta.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {meta.description}
                    </span>
                  </span>
                  <GripVertical
                    className="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground"
                    aria-hidden
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-64">
                {hint}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </aside>
  );
}
