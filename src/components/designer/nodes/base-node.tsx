"use client";

import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";

import { KIND_STYLE, NOTE_COLORS, STATUS_STYLE } from "@/components/designer/nodes/kind-style";
import { useDesignerStore } from "@/components/designer/store-provider";
import type { FlowNode } from "@/components/designer/to-flow";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NODE_KIND_META } from "@/lib/design/catalog";
import type { DesignNode } from "@/lib/design/schema";
import { cn } from "@/lib/utils";

const SIDES = [
  ["top", Position.Top],
  ["right", Position.Right],
  ["bottom", Position.Bottom],
  ["left", Position.Left],
] as const;

/**
 * All handles are "source" handles: with ConnectionMode.Loose any handle can start or end a
 * connection, and the direction is always drag-start → drop target.
 */
function Handles() {
  return SIDES.map(([id, position]) => (
    <Handle
      key={id}
      id={id}
      type="source"
      position={position}
      className="size-2.5! border-background! bg-primary! opacity-0 transition-opacity group-hover/node:opacity-100 group-data-[selected=true]/node:opacity-100"
    />
  ));
}

function subtitleOf(n: DesignNode): string {
  switch (n.kind) {
    case "service":
      return [
        n.data.type,
        [n.data.language, n.data.framework].filter(Boolean).join("/"),
        n.data.port !== null && `:${n.data.port}`,
      ]
        .filter(Boolean)
        .join(" · ");
    case "layer":
      return n.data.path;
    case "module":
      return (
        n.data.responsibilities[0] ??
        (n.data.exports.length > 0 ? `${n.data.exports.length} exports` : "")
      );
    case "datastore":
      return [n.data.engine, n.data.version].filter(Boolean).join(" ");
    case "api":
      return `${n.data.style} · ${n.data.operations.length} operations`;
    case "integration":
      return [n.data.provider, n.data.category].filter(Boolean).join(" · ");
    case "queue":
      return `${n.data.technology} · ${n.data.channels.length} channels`;
    case "actor":
      return n.data.type;
    default:
      return "";
  }
}

function StatusDot({ status }: { status: NonNullable<FlowNode["data"]["status"]> }) {
  const style = STATUS_STYLE[status.status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={`Status: ${style.label}`}
          data-status={status.status}
          className={cn("inline-block size-2.5 shrink-0 rounded-full", style.dot)}
        />
      </TooltipTrigger>
      <TooltipContent>
        {style.label}
        {status.note ? ` · ${status.note}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

function Chips({ node }: { node: DesignNode }) {
  const chips = [...node.patterns.map((p) => p.name), ...node.tags.map((t) => `#${t}`)];
  if (chips.length === 0) return null;
  const shown = node.patterns.slice(0, 2).map((p) => p.name);
  const more = node.patterns.length - shown.length;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {shown.map((name) => (
        <span key={name} className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none">
          {name}
        </span>
      ))}
      {more > 0 && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none">+{more}</span>
      )}
      {node.tags.slice(0, 3).map((t) => (
        <span
          key={t}
          className="rounded border px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Title({ data }: { data: FlowNode["data"] }) {
  const { node, status } = data;
  const style = KIND_STYLE[node.kind];
  const Icon = style.icon;
  const subtitle = subtitleOf(node);
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5 shrink-0", style.text)} aria-hidden />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {NODE_KIND_META[node.kind].label}
        </span>
        {status && (
          <span className="ml-auto">
            <StatusDot status={status} />
          </span>
        )}
      </div>
      <div className="truncate text-sm font-medium" title={node.name}>
        {node.name}
      </div>
      {subtitle && (
        <div className="truncate text-xs text-muted-foreground" title={subtitle}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

/** Leaf node: module, api, integration, queue, actor. */
export function CardNode({ data, selected }: NodeProps<FlowNode>) {
  const style = KIND_STYLE[data.node.kind];
  return (
    <div
      data-selected={selected}
      className={cn(
        "group/node w-52 rounded-md border border-l-[3px] bg-card px-2.5 py-2 shadow-sm",
        style.border,
        selected && "ring-2 ring-primary",
      )}
    >
      <Handles />
      <Title data={data} />
      <Chips node={data.node} />
    </div>
  );
}

export function EntityNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  if (node.kind !== "entity") return null;
  const style = KIND_STYLE.entity;
  const fields = node.data.fields.slice(0, 6);
  return (
    <div
      data-selected={selected}
      className={cn(
        "group/node w-52 rounded-md border border-l-[3px] bg-card px-2.5 py-2 shadow-sm",
        style.border,
        selected && "ring-2 ring-primary",
      )}
    >
      <Handles />
      <Title data={data} />
      {fields.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-t pt-1.5 font-mono text-[11px]">
          {fields.map((f) => (
            <li key={f.name} className="flex gap-1 truncate">
              <span className="w-5 shrink-0 text-amber-600">
                {f.primary ? "PK" : f.required ? "" : "?"}
              </span>
              <span className="truncate">
                {f.name}:{" "}
                <span className="text-muted-foreground">
                  {f.type}
                  {f.list ? "[]" : ""}
                </span>
              </span>
            </li>
          ))}
          {node.data.fields.length > fields.length && (
            <li className="text-muted-foreground">
              +{node.data.fields.length - fields.length} more
            </li>
          )}
        </ul>
      )}
      <Chips node={node} />
    </div>
  );
}

export function NoteNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  if (node.kind !== "note") return null;
  return (
    <div
      data-selected={selected}
      className={cn(
        "group/node h-28 w-52 overflow-hidden rounded-sm p-2.5 text-xs shadow-sm",
        NOTE_COLORS[node.data.color],
        selected && "ring-2 ring-primary",
      )}
    >
      <Handles />
      <div className="mb-1 font-medium">{node.name}</div>
      <p className="line-clamp-4 whitespace-pre-wrap">{node.description}</p>
    </div>
  );
}

/** Resizable group node: service, layer, datastore. Children are separate nodes drawn above it. */
export function ContainerNode({ id, data, selected }: NodeProps<FlowNode>) {
  const store = useDesignerStore();
  const style = KIND_STYLE[data.node.kind];
  return (
    <div
      data-selected={selected}
      className={cn(
        "group/node h-full w-full rounded-lg border border-l-[3px] border-dashed",
        style.border,
        style.tint,
        selected && "ring-2 ring-primary",
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={80}
        onResizeEnd={(_, p) =>
          store
            .getState()
            .commitGeometry([
              { id, position: { x: p.x, y: p.y }, size: { width: p.width, height: p.height } },
            ])
        }
      />
      <Handles />
      <div className="px-2.5 py-1.5">
        <Title data={data} />
        <Chips node={data.node} />
      </div>
    </div>
  );
}
