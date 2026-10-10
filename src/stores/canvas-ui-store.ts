import { create } from "zustand";

import type { Perspective } from "@/lib/design/perspectives";

export type ViewMode = "all" | "levels";

interface CanvasUiState {
  /** Who the canvas is drawn for (see lib/design/perspectives.ts); independent of viewMode. */
  perspective: Perspective;
  /** "all": every node, nested. "levels": one level at a time (see lib/design/levels.ts). */
  viewMode: ViewMode;
  /** The container or module the levels view is drilled into; null = project level. */
  focusId: string | null;
  validationOpen: boolean;
  minimapOpen: boolean;
  /** The "changed elsewhere" dialog (opened by autosave or the header). */
  conflictOpen: boolean;
  setPerspective(perspective: Perspective): void;
  setViewMode(mode: ViewMode): void;
  /** Drill into a node (switching to the levels view), or back to the project with null. */
  setFocus(focusId: string | null): void;
  toggleValidation(open?: boolean): void;
  toggleMinimap(): void;
  setConflictOpen(open: boolean): void;
}

/** View toggles shared by the project header and the canvas toolbar. */
export const useCanvasUi = create<CanvasUiState>((set) => ({
  perspective: "architecture",
  viewMode: "all",
  focusId: null,
  validationOpen: false,
  minimapOpen: true,
  conflictOpen: false,
  setPerspective: (perspective) => set({ perspective }),
  setViewMode: (viewMode) => set({ viewMode }),
  setFocus: (focusId) => set({ viewMode: "levels", focusId }),
  toggleValidation: (open) => set((s) => ({ validationOpen: open ?? !s.validationOpen })),
  toggleMinimap: () => set((s) => ({ minimapOpen: !s.minimapOpen })),
  setConflictOpen: (open) => set({ conflictOpen: open }),
}));
