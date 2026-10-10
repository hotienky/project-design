"use client";

import { Boxes, Plug, Rows3, type LucideIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PERSPECTIVE_META, PERSPECTIVES, type Perspective } from "@/lib/design/perspectives";
import { cn } from "@/lib/utils";
import { useCanvasUi } from "@/stores/canvas-ui-store";

const ICON: Record<Perspective, LucideIcon> = {
  architecture: Boxes,
  api: Plug,
  layers: Rows3,
};

/** Architecture | API | Layers: who the canvas is drawn for. */
export function PerspectiveSwitch() {
  const current = useCanvasUi((s) => s.perspective);
  return (
    <div
      role="radiogroup"
      aria-label="Perspective"
      className="inline-flex items-center gap-0.5 rounded-lg border bg-muted p-0.5 shadow-xs"
    >
      {PERSPECTIVES.map((p) => {
        const Icon = ICON[p];
        const active = p === current;
        return (
          <Tooltip key={p}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors [&_svg]:size-3.5",
                  active
                    ? "bg-background font-medium text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => useCanvasUi.getState().setPerspective(p)}
              >
                <Icon aria-hidden />
                {PERSPECTIVE_META[p].label}
              </button>
            </TooltipTrigger>
            <TooltipContent>{PERSPECTIVE_META[p].description}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
