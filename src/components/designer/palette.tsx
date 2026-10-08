"use client";

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
      className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r bg-background p-2"
    >
      <h2 className="px-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Add component
      </h2>
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
                  "flex items-center gap-2 rounded-md border border-l-[3px] bg-card px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  style.border,
                  disabled && "opacity-50",
                )}
              >
                <Icon className={cn("size-4 shrink-0", style.text)} aria-hidden />
                {meta.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-64">
              {hint}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </aside>
  );
}
