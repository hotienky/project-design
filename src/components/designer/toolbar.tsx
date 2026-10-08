"use client";

import { Map as MapIcon, Maximize, Redo2, ShieldCheck, Undo2 } from "lucide-react";

import { useCanvasActions } from "@/components/designer/canvas-actions";
import { useTemporal } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCanvasUi } from "@/stores/canvas-ui-store";

function Tool({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={pressed ? "secondary" : "ghost"}
          size="icon-sm"
          className="rounded-none"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Toolbar() {
  const canUndo = useTemporal((t) => t.pastStates.length > 0);
  const canRedo = useTemporal((t) => t.futureStates.length > 0);
  const undo = useTemporal((t) => t.undo);
  const redo = useTemporal((t) => t.redo);
  const actions = useCanvasActions();
  const validationOpen = useCanvasUi((s) => s.validationOpen);
  const minimapOpen = useCanvasUi((s) => s.minimapOpen);
  return (
    <div
      role="toolbar"
      aria-label="Canvas tools"
      className="flex items-center divide-x overflow-hidden rounded-lg border bg-background shadow-xs"
    >
      <Tool label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => undo()}>
        <Undo2 />
      </Tool>
      <Tool label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => redo()}>
        <Redo2 />
      </Tool>
      <Tool label="Fit view" onClick={() => actions.fitView()}>
        <Maximize />
      </Tool>
      <Tool
        label="Validation panel"
        pressed={validationOpen}
        onClick={() => useCanvasUi.getState().toggleValidation()}
      >
        <ShieldCheck />
      </Tool>
      <Tool
        label="Minimap"
        pressed={minimapOpen}
        onClick={() => useCanvasUi.getState().toggleMinimap()}
      >
        <MapIcon />
      </Tool>
    </div>
  );
}
