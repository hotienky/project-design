"use client";
// PROTOTYPE — Phase 5 replaces this with the full designer (§12).
import "@xyflow/react/dist/style.css";

import { Background, Controls, MiniMap, ReactFlow, type Node } from "@xyflow/react";
import { useTheme } from "next-themes";
import { useMemo } from "react";

import type { DesignDocument } from "@/lib/design/schema";

export function DesignerCanvas({ document }: { document: DesignDocument }) {
  const { resolvedTheme } = useTheme();
  const nodes = useMemo<Node[]>(
    () =>
      document.nodes.map((n) => ({
        id: n.id,
        position: n.position,
        parentId: n.parentId ?? undefined,
        data: { label: `${n.kind}: ${n.name}` },
        ...(n.size ? { width: n.size.width, height: n.size.height } : {}),
      })),
    [document.nodes],
  );
  const edges = useMemo(
    () =>
      document.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.kind })),
    [document.edges],
  );
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      colorMode={resolvedTheme === "dark" ? "dark" : "light"}
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}
