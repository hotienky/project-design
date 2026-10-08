"use client";

import { createContext, useContext, useMemo, useRef, type RefObject } from "react";

import type { NodeKind } from "@/lib/design/schema";

/** What the palette, inspector and validation panel can ask the canvas to do. */
export interface CanvasActions {
  /** Add a node of `kind` at the centre of the visible canvas (inside the selected container if needed). */
  addNodeAtCenter(kind: NodeKind): void;
  /** Add a node whose centre is at a flow-space point, e.g. after a palette drop. */
  addNodeAt(kind: NodeKind, center: { x: number; y: number }): void;
  /** Scroll the canvas so the node or edge is centred. */
  focus(target: { nodeId?: string; edgeId?: string }): void;
  /** Delete the selection, asking first when containers with children are included. */
  deleteSelection(): void;
  fitView(): void;
}

const noop: CanvasActions = {
  addNodeAtCenter() {},
  addNodeAt() {},
  focus() {},
  deleteSelection() {},
  fitView() {},
};

const Ctx = createContext<RefObject<CanvasActions> | null>(null);

export function CanvasActionsProvider({
  actionsRef,
  children,
}: {
  actionsRef: RefObject<CanvasActions>;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={actionsRef}>{children}</Ctx.Provider>;
}

export function useActionsRef(): RefObject<CanvasActions> {
  const fallback = useRef<CanvasActions>(noop);
  return useContext(Ctx) ?? fallback;
}

/** Stable object delegating to whatever the canvas registered. */
export function useCanvasActions(): CanvasActions {
  const ref = useActionsRef();
  return useMemo(
    () => ({
      addNodeAtCenter: (k) => ref.current.addNodeAtCenter(k),
      addNodeAt: (k, c) => ref.current.addNodeAt(k, c),
      focus: (t) => ref.current.focus(t),
      deleteSelection: () => ref.current.deleteSelection(),
      fitView: () => ref.current.fitView(),
    }),
    [ref],
  );
}
