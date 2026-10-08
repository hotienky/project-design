import { create } from "zustand";

interface CanvasUiState {
  validationOpen: boolean;
  minimapOpen: boolean;
  /** The "changed elsewhere" dialog (opened by autosave or the header). */
  conflictOpen: boolean;
  toggleValidation(open?: boolean): void;
  toggleMinimap(): void;
  setConflictOpen(open: boolean): void;
}

/** View toggles shared by the project header and the canvas toolbar. */
export const useCanvasUi = create<CanvasUiState>((set) => ({
  validationOpen: false,
  minimapOpen: true,
  conflictOpen: false,
  toggleValidation: (open) => set((s) => ({ validationOpen: open ?? !s.validationOpen })),
  toggleMinimap: () => set((s) => ({ minimapOpen: !s.minimapOpen })),
  setConflictOpen: (open) => set({ conflictOpen: open }),
}));
