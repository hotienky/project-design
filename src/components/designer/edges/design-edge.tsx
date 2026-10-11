"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";

import { Z, type FlowEdge } from "@/components/designer/to-flow";
import type { EdgeKind } from "@/lib/design/schema";

/** Each kind has its own colour; dashes tell structural, data and async links apart. */
const STYLE: Record<EdgeKind, { stroke: string; width: number; dash?: string }> = {
  depends_on: { stroke: "#94a3b8", width: 1.5, dash: "6 4" },
  calls: { stroke: "#0ea5e9", width: 1.5 },
  exposes: { stroke: "#8b5cf6", width: 2.5 },
  accesses: { stroke: "#10b981", width: 1.5, dash: "2 4" },
  publishes: { stroke: "#f97316", width: 1.5, dash: "5" },
  subscribes: { stroke: "#f97316", width: 1.5, dash: "5" },
  uses: { stroke: "#ec4899", width: 1.5 },
  relation: { stroke: "#f59e0b", width: 1.5 },
  interacts: { stroke: "#14b8a6", width: 1.25 },
  drives: { stroke: "#f43f5e", width: 1.5, dash: "6 4" },
  produces: { stroke: "#84cc16", width: 1.75 },
  consumes: { stroke: "#ef4444", width: 1.75 },
  triggers: { stroke: "#f59e0b", width: 1.5, dash: "5" },
  modifies: { stroke: "#d946ef", width: 1.5, dash: "2 4" },
};

const VIOLATION = "#ef4444";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const boxOf = (n: InternalNode): Box => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  w: n.measured.width ?? 1,
  h: n.measured.height ?? 1,
});

/** Where the line between the two centres leaves `from`'s border, and which side that is. */
function borderPoint(from: Box, to: Box): { x: number; y: number; position: Position } {
  const w = from.w / 2;
  const h = from.h / 2;
  const cx = from.x + w;
  const cy = from.y + h;
  const dx = to.x + to.w / 2 - cx;
  const dy = to.y + to.h / 2 - cy;
  const scale = 1 / Math.max(Math.abs(dx) / w, Math.abs(dy) / h, 1e-6);
  const x = cx + dx * scale;
  const y = cy + dy * scale;
  const position =
    Math.abs(dx) / w > Math.abs(dy) / h
      ? dx > 0
        ? Position.Right
        : Position.Left
      : dy > 0
        ? Position.Bottom
        : Position.Top;
  return { x, y, position };
}

/** A "floating" smooth-step edge: it attaches to the nearest border, not to a fixed handle. */
export function DesignEdgeView({ id, source, target, data, selected }: EdgeProps<FlowEdge>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode || !data) return null;

  const a = boxOf(sourceNode);
  const b = boxOf(targetNode);
  const from = borderPoint(a, b);
  const to = borderPoint(b, a);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: from.x,
    sourceY: from.y,
    sourcePosition: from.position,
    targetX: to.x,
    targetY: to.y,
    targetPosition: to.position,
    borderRadius: 8,
  });
  const lifted = data.lifted ?? 0;
  const style = STYLE[data.edge.kind];
  const isDimmed = data.dimmed;
  const isHighlighted = data.highlighted || selected;
  const stroke = isHighlighted ? "var(--primary)" : data.violation ? VIOLATION : style.stroke;
  const strokeWidth = isHighlighted ? style.width + 1.25 : style.width;
  const opacity = isDimmed ? 0.08 : lifted ? 0.55 : 1;
  // Lifted edge ids contain ":", which doesn't belong in a url(#…) reference.
  const marker = `pd-arrow-${id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  return (
    <>
      <defs>
        <marker
          id={marker}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 1 L9 5 L0 9 z" fill={stroke} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={isDimmed ? undefined : `url(#${marker})`}
        interactionWidth={16}
        style={{
          stroke,
          strokeWidth,
          opacity,
          transition: "opacity 0.2s, stroke-width 0.2s",
          ...(style.dash ? { strokeDasharray: style.dash } : {}),
        }}
      />
      {!isDimmed && (
        <circle
          cx={from.x}
          cy={from.y}
          r={3.5}
          fill={stroke}
          stroke="var(--background)"
          strokeWidth={1.5}
        />
      )}
      {!isDimmed && (
        <EdgeLabelRenderer>
          <div
            title={
              lifted
                ? `${lifted} connection${lifted === 1 ? "" : "s"} from nested components`
                : undefined
            }
            className="nodrag nopan pointer-events-auto absolute rounded-full border bg-background px-2 py-0.5 text-[10px] leading-none font-medium shadow-xs"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              zIndex: isHighlighted ? Z.label + 1 : Z.label,
              borderColor: stroke,
              color: `color-mix(in oklch, ${stroke} 70%, var(--foreground))`,
            }}
          >
            {data.caption}
            {lifted > 1 && ` ×${lifted}`}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { design: DesignEdgeView };
