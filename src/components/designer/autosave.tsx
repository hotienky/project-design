"use client";

import { useEffect, useRef } from "react";

import { createAutosaver, type SaveOutcome } from "@/components/designer/autosaver";
import { useDesignerStore, useSaveNowRef } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCanvasUi } from "@/stores/canvas-ui-store";
import { isDirty } from "@/stores/designer-store";

const DEBOUNCE_MS = 800;
const RETRY_MS = [2000, 4000, 8000, 16000, 30000];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);

/** Saves the draft in the background (see CURRENT_PLAN §12), resolves conflicts, and owns the keyboard shortcuts. */
export function Autosave() {
  const store = useDesignerStore();
  const saveNowRef = useSaveNowRef();
  const conflict = useCanvasUi((s) => s.conflictOpen);
  const setConflict = useCanvasUi((s) => s.setConflictOpen);
  const saverRef = useRef<ReturnType<typeof createAutosaver> | null>(null);

  useEffect(() => {
    const slug = store.getState().slug;
    const url = `/api/projects/${slug}/design`;

    async function save(): Promise<SaveOutcome> {
      const state = store.getState();
      if (!isDirty(state)) return "saved";
      const sent = state.document;
      state.markSaving();
      let response: Response;
      try {
        response = await fetch(url, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ revision: state.revision, document: sent }),
        });
      } catch {
        store.getState().markSaveFailed("error", "Couldn't save");
        return "failed";
      }
      if (response.ok) {
        const body = (await response.json()) as { revision: number };
        store.getState().markSaved(sent, body.revision);
        return "saved";
      }
      const body = await response.json().catch(() => null);
      if (response.status === 409) {
        store.getState().markSaveFailed("conflict", "Changed elsewhere");
        useCanvasUi.getState().setConflictOpen(true);
        return "conflict";
      }
      if (response.status === 422) {
        // A bug signal: the editor should never produce a document the server rejects.
        console.error("[autosave] the server rejected the document", body?.error?.details);
        const first = body?.error?.details?.[0]?.message ?? "The design is invalid";
        store.getState().markSaveFailed("error", first);
        return "invalid";
      }
      store.getState().markSaveFailed("error", "Couldn't save");
      return "failed";
    }

    const saver = createAutosaver({
      debounceMs: DEBOUNCE_MS,
      retryMs: RETRY_MS,
      save,
      isDirty: () => isDirty(store.getState()),
    });
    saverRef.current = saver;
    saveNowRef.current = saver.saveNow;

    const unsubscribe = store.subscribe((state, previous) => {
      if (state.document !== previous.document && isDirty(state)) saver.notifyChange();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void saver.saveNow();
        return;
      }
      if (isTyping(event.target)) return;
      const history = store.temporal.getState();
      if (key === "z" && !event.shiftKey) history.undo();
      else if ((key === "z" && event.shiftKey) || key === "y") history.redo();
      else return;
      event.preventDefault();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const { status } = store.getState();
      if (isDirty(store.getState()) || status === "saving") event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unsubscribe();
      saver.dispose();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [store, saveNowRef]);

  async function fetchCurrent() {
    const response = await fetch(`/api/projects/${store.getState().slug}/design`);
    if (!response.ok) throw new Error("fetch failed");
    return (await response.json()) as { revision: number; document: never };
  }

  async function reload() {
    try {
      const current = await fetchCurrent();
      store.getState().replaceDocument(current.document, current.revision);
      store.temporal.getState().clear();
      setConflict(false);
      saverRef.current?.resume();
    } catch {
      store.getState().markSaveFailed("conflict", "Couldn't reload. Try again.");
    }
  }

  async function keepMine() {
    try {
      const current = await fetchCurrent();
      store.setState({ revision: current.revision, status: "idle", statusMessage: null });
      setConflict(false);
      saverRef.current?.resume();
    } catch {
      store.getState().markSaveFailed("conflict", "Couldn't reach the server. Try again.");
    }
  }

  return (
    <Dialog open={conflict} onOpenChange={setConflict}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>This design changed somewhere else</DialogTitle>
          <DialogDescription>
            Another tab, an import or a restore saved a newer version. Reload to get it (your
            unsaved edits here are discarded), or keep your version and overwrite it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={keepMine}>
            Keep mine
          </Button>
          <Button onClick={reload}>Reload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
