import { create } from "zustand";

interface SelectionState {
  nodeIds: string[];
  edgeIds: string[];
  /** The node whose name field the inspector should focus (set when it was just created). */
  focusNameFor: string | null;
  set(nodeIds: string[], edgeIds: string[]): void;
  clear(): void;
  requestNameFocus(nodeId: string): void;
  consumeNameFocus(): void;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export const useSelection = create<SelectionState>((set, get) => ({
  nodeIds: [],
  edgeIds: [],
  focusNameFor: null,
  set(nodeIds, edgeIds) {
    const s = get();
    if (same(s.nodeIds, nodeIds) && same(s.edgeIds, edgeIds)) return;
    set({ nodeIds, edgeIds });
  },
  clear() {
    get().set([], []);
  },
  requestNameFocus(nodeId) {
    set({ focusNameFor: nodeId });
  },
  consumeNameFocus() {
    set({ focusNameFor: null });
  },
}));
