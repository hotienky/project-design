"use client";

import { createContext, useCallback, useContext, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { TemporalState } from "zundo";

import { Autosave } from "@/components/designer/autosave";
import type { DesignDocument } from "@/lib/design/schema";
import {
  createDesignerStore,
  type DesignerState,
  type DesignerStore,
} from "@/stores/designer-store";

export interface ProjectMeta {
  name: string;
  slug: string;
  description: string;
}

interface Context {
  store: DesignerStore;
  meta: ProjectMeta;
  saveNowRef: RefObject<() => Promise<void>>;
}

const DesignerContext = createContext<Context | null>(null);

function useContextOrThrow(): Context {
  const ctx = useContext(DesignerContext);
  if (!ctx) throw new Error("useDesigner must be used inside DesignerStoreProvider");
  return ctx;
}

export function DesignerStoreProvider({
  initial,
  meta,
  children,
}: {
  initial: { document: DesignDocument; revision: number };
  meta: ProjectMeta;
  children: React.ReactNode;
}) {
  // One store per mount; the layout keys this component by slug.
  const [store] = useState(() =>
    createDesignerStore({
      slug: meta.slug,
      document: initial.document,
      revision: initial.revision,
      onReject: (message) => toast.error(`Change not applied: ${message}`),
    }),
  );
  const saveNowRef = useRef<() => Promise<void>>(async () => {});
  return (
    <DesignerContext.Provider value={{ store, meta, saveNowRef }}>
      <Autosave />
      {children}
    </DesignerContext.Provider>
  );
}

export const useDesignerStore = () => useContextOrThrow().store;
export const useProjectMeta = () => useContextOrThrow().meta;

export function useDesigner<T>(selector: (state: DesignerState) => T): T {
  return useStore(useContextOrThrow().store, selector);
}

/** Undo/redo history state and actions (zundo). */
export function useTemporal<T>(
  selector: (state: TemporalState<{ document: DesignDocument }>) => T,
): T {
  return useStore(useContextOrThrow().store.temporal, selector);
}

/** Saves the draft right now (also what Ctrl/⌘+S does). */
export function useSaveNow(): () => Promise<void> {
  const { saveNowRef } = useContextOrThrow();
  return useCallback(() => saveNowRef.current(), [saveNowRef]);
}

export function useSaveNowRef() {
  return useContextOrThrow().saveNowRef;
}
