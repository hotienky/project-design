import { create } from "zustand";

import type { Perspective } from "@/lib/design/perspectives";
import type { NodeKind } from "@/lib/design/schema";

export type ViewMode = "all" | "levels";
export type LeftSidebarTab = "palette" | "explorer";
export type PaletteLayout = "grid" | "list";

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
  /** Left sidebar visibility and active tab (Palette vs Project Explorer). */
  leftSidebarOpen: boolean;
  leftSidebarTab: LeftSidebarTab;
  /** Palette layout mode: "grid" (compact 2-column) or "list" (compact 1-column). */
  paletteLayout: PaletteLayout;
  /** Right sidebar (Inspector) visibility. */
  rightSidebarOpen: boolean;
  /** Explorer search and filtering. */
  searchQuery: string;
  activeFilterKind: NodeKind | "all";

  setPerspective(perspective: Perspective): void;
  setViewMode(mode: ViewMode): void;
  /** Drill into a node (switching to the levels view), or back to the project with null. */
  setFocus(focusId: string | null): void;
  toggleValidation(open?: boolean): void;
  toggleMinimap(): void;
  setConflictOpen(open: boolean): void;
  toggleLeftSidebar(): void;
  setLeftSidebarOpen(open: boolean): void;
  setLeftSidebarTab(tab: LeftSidebarTab): void;
  setPaletteLayout(layout: PaletteLayout): void;
  toggleRightSidebar(): void;
  setRightSidebarOpen(open: boolean): void;
  setSearchQuery(query: string): void;
  setActiveFilterKind(kind: NodeKind | "all"): void;
}

/** View toggles shared by the project header and the canvas toolbar. */
export const useCanvasUi = create<CanvasUiState>((set) => ({
  perspective: "architecture",
  viewMode: "all",
  focusId: null,
  validationOpen: false,
  minimapOpen: true,
  conflictOpen: false,
  leftSidebarOpen: true,
  leftSidebarTab: "palette",
  paletteLayout: "grid",
  rightSidebarOpen: true,
  searchQuery: "",
  activeFilterKind: "all",

  setPerspective: (perspective) => set({ perspective }),
  setViewMode: (viewMode) => set({ viewMode }),
  setFocus: (focusId) => set({ viewMode: "levels", focusId }),
  toggleValidation: (open) => set((s) => ({ validationOpen: open ?? !s.validationOpen })),
  toggleMinimap: () => set((s) => ({ minimapOpen: !s.minimapOpen })),
  setConflictOpen: (open) => set({ conflictOpen: open }),
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  setLeftSidebarOpen: (leftSidebarOpen) => set({ leftSidebarOpen }),
  setLeftSidebarTab: (leftSidebarTab) => set({ leftSidebarTab, leftSidebarOpen: true }),
  setPaletteLayout: (paletteLayout) => set({ paletteLayout }),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  setRightSidebarOpen: (rightSidebarOpen) => set({ rightSidebarOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveFilterKind: (activeFilterKind) => set({ activeFilterKind }),
}));
