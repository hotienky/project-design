"use client";

import {
  Crosshair,
  Database,
  Layers,
  LayoutGrid,
  Map as MapIcon,
  Maximize,
  Minus,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useEffect } from "react";

import { useCanvasActions } from "@/components/designer/canvas-actions";
import { useDesigner, useTemporal } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { validateDesign } from "@/lib/design/validate";
import { cn } from "@/lib/utils";
import { useCanvasUi } from "@/stores/canvas-ui-store";

function Tool({
  label,
  onClick,
  disabled,
  pressed,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={pressed ? "secondary" : "ghost"}
          size="icon-sm"
          className={cn(
            "relative size-8.5 rounded-none transition-colors",
            pressed && "bg-accent font-medium text-foreground",
          )}
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
          {badge}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Toolbar() {
  const readOnly = useDesigner((s) => s.readOnly);
  const document = useDesigner((s) => s.document);
  const canUndo = useTemporal((t) => t.pastStates.length > 0) && !readOnly;
  const canRedo = useTemporal((t) => t.futureStates.length > 0) && !readOnly;
  const undo = useTemporal((t) => t.undo);
  const redo = useTemporal((t) => t.redo);
  const actions = useCanvasActions();

  const validationOpen = useCanvasUi((s) => s.validationOpen);
  const minimapOpen = useCanvasUi((s) => s.minimapOpen);
  const viewMode = useCanvasUi((s) => s.viewMode);
  const leftOpen = useCanvasUi((s) => s.leftSidebarOpen);
  const rightOpen = useCanvasUi((s) => s.rightSidebarOpen);
  const focusMode = useCanvasUi((s) => s.focusMode);
  const collapseDatastores = useCanvasUi((s) => s.collapseDatastores);

  // Issues count for validation badge
  const issues = validateDesign(document, { layout: viewMode });
  const hasErrors = issues.some((i) => i.severity === "error");
  const hasWarnings = issues.some((i) => i.severity === "warning");

  // Keyboard shortcuts for canvas toggle controls
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }
      // Do not trigger canvas shortcuts if a modal dialog, alert dialog, or sheet is open
      if (
        window.document.querySelector('[role="dialog"], [role="alertdialog"]') ||
        (e.target instanceof HTMLElement &&
          e.target.closest('[role="dialog"], [role="alertdialog"]'))
      ) {
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        useCanvasUi.getState().toggleLeftSidebar();
      } else if (e.key === "]") {
        e.preventDefault();
        useCanvasUi.getState().toggleRightSidebar();
      } else if (e.key === "f" || e.key === "F") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          actions.fitView();
        }
      } else if (e.key === "t" || e.key === "T") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          useCanvasUi.getState().toggleFocusMode();
        }
      } else if (e.key === "w" || e.key === "W") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          useCanvasUi.getState().startWalkthrough();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions]);

  return (
    <div
      role="toolbar"
      aria-label="Canvas control dock"
      className="flex items-center divide-x divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-background/95 shadow-md backdrop-blur-md transition-all hover:border-border hover:shadow-lg"
    >
      {/* Left panel toggle */}
      <Tool
        label="Toggle sidebar ([)"
        pressed={leftOpen}
        onClick={() => useCanvasUi.getState().toggleLeftSidebar()}
      >
        <PanelLeft className="size-4" />
      </Tool>

      {/* Undo & Redo */}
      <div className="flex items-center divide-x divide-border/50">
        <Tool label="Undo (⌘Z / Ctrl+Z)" disabled={!canUndo} onClick={() => undo()}>
          <Undo2 className="size-4" />
        </Tool>
        <Tool label="Redo (⌘⇧Z / Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => redo()}>
          <Redo2 className="size-4" />
        </Tool>
      </div>

      {/* View modes: All vs Levels */}
      <div className="flex items-center divide-x divide-border/50">
        <Tool
          label="All view: every component, nested"
          pressed={viewMode === "all"}
          onClick={() => useCanvasUi.getState().setViewMode("all")}
        >
          <LayoutGrid className="size-4" />
        </Tool>
        <Tool
          label="Levels view: project › service › layer › module"
          pressed={viewMode === "levels"}
          onClick={() => useCanvasUi.getState().setViewMode("levels")}
        >
          <Layers className="size-4" />
        </Tool>
      </div>

      {/* Flow focus & datastore density controls */}
      <div className="flex items-center divide-x divide-border/50">
        <Tool
          label={
            focusMode
              ? "Focus mode ON: trace flow & dim noise (T)"
              : "Focus mode OFF: show all connections (T)"
          }
          pressed={focusMode}
          onClick={() => useCanvasUi.getState().toggleFocusMode()}
        >
          <Crosshair className="size-4" />
        </Tool>
        <Tool
          label={
            collapseDatastores
              ? "Datastores collapsed (clean view)"
              : "Datastores expanded (showing all tables)"
          }
          pressed={collapseDatastores}
          onClick={() => useCanvasUi.getState().toggleCollapseDatastores()}
        >
          <Database className="size-4" />
        </Tool>
      </div>

      {/* Zoom & Fit controls */}
      <div className="flex items-center divide-x divide-border/50">
        <Tool label="Zoom out (-)" onClick={() => actions.zoomOut()}>
          <Minus className="size-3.5" />
        </Tool>
        <Tool label="Fit view (F)" onClick={() => actions.fitView()}>
          <Maximize className="size-3.5" />
        </Tool>
        <Tool label="Zoom in (+)" onClick={() => actions.zoomIn()}>
          <Plus className="size-3.5" />
        </Tool>
      </div>

      {/* Tools & Panels */}
      <div className="flex items-center divide-x divide-border/50">
        <Tool
          label={hasErrors ? `Validation: ${issues.length} errors/warnings` : "Validation panel"}
          pressed={validationOpen}
          badge={
            hasErrors ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500" />
            ) : hasWarnings ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500" />
            ) : null
          }
          onClick={() => useCanvasUi.getState().toggleValidation()}
        >
          {hasErrors ? (
            <ShieldAlert className="size-4 text-red-500" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
        </Tool>
        <Tool
          label="Minimap"
          pressed={minimapOpen}
          onClick={() => useCanvasUi.getState().toggleMinimap()}
        >
          <MapIcon className="size-4" />
        </Tool>
        <Tool
          label="Tour architecture flow (W)"
          onClick={() => useCanvasUi.getState().startWalkthrough()}
        >
          <Sparkles className="size-4 text-primary" />
        </Tool>
      </div>

      {/* Right panel toggle */}
      <Tool
        label="Toggle inspector (])"
        pressed={rightOpen}
        onClick={() => useCanvasUi.getState().toggleRightSidebar()}
      >
        <PanelRight className="size-4" />
      </Tool>
    </div>
  );
}
