import { create } from "zustand";

import type { ComponentStatus } from "@/lib/design/status";

export interface StatusEntry {
  status: ComponentStatus;
  note: string;
  updatedAt: string;
}

interface StatusState {
  slug: string | null;
  statuses: Record<string, StatusEntry>;
  replace(slug: string, statuses: Record<string, StatusEntry>): void;
}

/** Agent-reported progress, polled from the server. Not part of the document or undo history. */
export const useStatusStore = create<StatusState>((set) => ({
  slug: null,
  statuses: {},
  replace: (slug, statuses) => set({ slug, statuses }),
}));
