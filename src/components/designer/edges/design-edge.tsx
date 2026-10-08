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

import type { FlowEdge } from "@/components/designer/to-flow";
import type { EdgeKind } from "@/lib/design/schema";

const STYLE: Record<EdgeKind, { stroke: string; width: number; dash?: string }> = {
  depends_on: { stroke: "var(--muted-foreground)", width: 1.5, dash: "6 4" },
  calls: { stroke: "var(--foreground)", width: 1.5 },
  exposes: { stroke: "var(--foreground)", width: 3 },
  accesses: { stroke: "var(--muted-foreground)", width: 1.5, dash: "2 4" },
  publishes: { stroke: "#f97316", width: 1.5, dash: "5" },
  subscribes: { stroke: "#f97316", width: 1.5, dash: "5" },
  uses: { stroke: "#ec4899", width: 1.5 },
  relation: { stroke: "#f59e0b", width: 1.5 },
  interacts: { stroke: "#14b8a6", width: 1 },
};

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
export function DesignEdgeView({
  id,
  source,
  target,
  data,
  selected,
  markerEnd,
}: EdgeProps<FlowEdge>) {
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
  const style = STYLE[data.edge.kind];
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={16}
        style={{
          stroke: selected ? "var(--primary)" : style.stroke,
          strokeWidth: style.width + (selected ? 1 : 0),
          ...(style.dash ? { strokeDasharray: style.dash } : {}),
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute rounded-full border bg-background px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground shadow-sm"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {data.caption}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = { design: DesignEdgeView };
