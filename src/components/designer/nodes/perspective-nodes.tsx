"use client";

import type { NodeProps } from "@xyflow/react";

import {
  card,
  chip,
  Chips,
  ContainerTitle,
  Handles,
  OpenButton,
  selectedRing,
  StatusChip,
  Title,
} from "@/components/designer/nodes/base-node";
import { KIND_STYLE } from "@/components/designer/nodes/kind-style";
import type { FlowNode } from "@/components/designer/to-flow";
import { isFocusable } from "@/lib/design/levels";
import { API_CARD } from "@/lib/design/perspectives";
import type { DesignNode } from "@/lib/design/schema";
import { cn } from "@/lib/utils";
import { useCanvasUi } from "@/stores/canvas-ui-store";

/** In the levels view, anything you can drill into gets an Open button (except the focus). */
function useOpenable(node: DesignNode) {
  return useCanvasUi((s) => s.viewMode === "levels" && s.focusId !== node.id) && isFocusable(node);
}

/** A component beside an API, or a module in a layer band; subtitled with where it lives. */
export function PerspectiveCardNode({ data, selected }: NodeProps<FlowNode>) {
  const openable = useOpenable(data.node);
  return (
    <div data-selected={selected} className={cn(card, selected && selectedRing)}>
      <Handles kind={data.node.kind} />
      <div className="flex items-start gap-1">
        <Title node={data.node} subtitle={data.label} />
        {openable && <OpenButton node={data.node} />}
      </div>
      <Chips data={data} className="mt-2" />
    </div>
  );
}

/** An API with its operations listed, the centre of the API perspective. */
export function ApiOperationsNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  if (node.kind !== "api") return null;
  const operations = node.data.operations;
  const shown = operations.slice(0, API_CARD.maxRows);
  return (
    <div
      data-selected={selected}
      className={cn(card, "flex h-full w-full flex-col overflow-hidden", selected && selectedRing)}
    >
      <Handles kind={node.kind} />
      <div className="flex items-start gap-1">
        <Title node={node} />
        {data.status && <StatusChip status={data.status} />}
      </div>
      <ul className="mt-2 min-h-0 flex-1 rounded-lg border bg-muted/40 px-2 py-1 text-[11px]">
        {operations.length === 0 && (
          <li className="leading-[20px] text-muted-foreground">No operations yet</li>
        )}
        {shown.map((op) => (
          <li
            key={op.id}
            className="flex items-baseline gap-2 leading-[20px]"
            title={op.summary || op.name}
          >
            <span className="w-12 shrink-0 font-mono text-[10px] font-semibold text-sky-600 dark:text-sky-400">
              {op.method ?? node.data.style}
            </span>
            <span className="truncate font-mono">
              {op.path !== null ? `${node.data.basePath}${op.path}` : op.name}
            </span>
          </li>
        ))}
        {operations.length > shown.length && (
          <li className="leading-[20px] text-muted-foreground">
            +{operations.length - shown.length} more
          </li>
        )}
      </ul>
    </div>
  );
}

/** A service drawn as a frame around its layer bands. */
export function ServiceFrameNode({ data, selected }: NodeProps<FlowNode>) {
  const style = KIND_STYLE[data.node.kind];
  const openable = useOpenable(data.node);
  return (
    <div
      data-selected={selected}
      className={cn(
        "group/node h-full w-full rounded-xl border",
        style.line,
        style.tint,
        selected && selectedRing,
      )}
    >
      <Handles kind={data.node.kind} />
      <div className="flex items-center gap-2 px-3 py-2.5">
        <ContainerTitle node={data.node} />
        <Chips data={data} className="justify-end" />
        {openable && <OpenButton node={data.node} />}
      </div>
      {data.label && <p className="px-3 text-xs text-muted-foreground">{data.label}</p>}
    </div>
  );
}

/**
 * One layer as a horizontal band, or the service's own modules ("Not in a layer"). Collapsed in
 * the overview, it shows how many components it holds.
 */
export function LayerBandNode({ data, selected }: NodeProps<FlowNode>) {
  const { node, label, collapsed } = data;
  const style = KIND_STYLE[node.kind];
  const openable = useOpenable(node) && !label;
  return (
    <div
      data-selected={selected}
      className={cn(
        "group/node h-full w-full rounded-lg border bg-background/70",
        label ? "border-dashed" : style.line,
        selected && selectedRing,
      )}
    >
      <Handles kind={node.kind} />
      <div className="flex items-center gap-2 px-2 py-1.5">
        {label ? (
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        ) : (
          <ContainerTitle node={node} />
        )}
        {collapsed !== undefined && (
          <span className={cn(chip, "ml-auto text-foreground/80")}>{collapsed} inside</span>
        )}
        {openable && <OpenButton node={node} />}
      </div>
    </div>
  );
}
