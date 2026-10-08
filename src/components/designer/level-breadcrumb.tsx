"use client";

import { ChevronRight } from "lucide-react";
import { Fragment, useMemo } from "react";

import { KIND_STYLE } from "@/components/designer/nodes/kind-style";
import { useDesigner } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { breadcrumb } from "@/lib/design/levels";
import { cn } from "@/lib/utils";
import { useCanvasUi } from "@/stores/canvas-ui-store";

/** Project › API › HTTP › Routes: where the levels view is drilled into; each step goes back up. */
export function LevelBreadcrumb({ focusId }: { focusId: string | null }) {
  const document = useDesigner((s) => s.document);
  const trail = useMemo(() => breadcrumb(document, focusId), [document, focusId]);
  const go = (id: string | null) => useCanvasUi.getState().setFocus(id);
  return (
    <nav
      aria-label="Level"
      className="flex max-w-[50vw] items-center overflow-hidden rounded-lg border bg-background px-1 shadow-xs"
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8 px-2", trail.length === 0 && "font-semibold")}
        aria-current={trail.length === 0 ? "location" : undefined}
        onClick={() => go(null)}
      >
        Project
      </Button>
      {trail.map((n, i) => {
        const Icon = KIND_STYLE[n.kind].icon;
        const last = i === trail.length - 1;
        return (
          <Fragment key={n.id}>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-8 min-w-0 px-2", last && "font-semibold")}
              aria-current={last ? "location" : undefined}
              onClick={() => go(n.id)}
            >
              <Icon className={KIND_STYLE[n.kind].text} aria-hidden />
              <span className="truncate">{n.name}</span>
            </Button>
          </Fragment>
        );
      })}
    </nav>
  );
}
