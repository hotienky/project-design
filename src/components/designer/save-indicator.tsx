"use client";

import { useDesigner, useSaveNow } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { useCanvasUi } from "@/stores/canvas-ui-store";
import { isDirty } from "@/stores/designer-store";

export function SaveIndicator() {
  const status = useDesigner((s) => s.status);
  const dirty = useDesigner(isDirty);
  const message = useDesigner((s) => s.statusMessage);
  const saveNow = useSaveNow();

  if (status === "conflict") {
    return (
      <span className="flex items-center gap-1 text-sm text-destructive" role="status">
        Changed elsewhere ·
        <Button
          variant="link"
          size="xs"
          className="px-0"
          onClick={() => useCanvasUi.getState().setConflictOpen(true)}
        >
          Reload
        </Button>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="flex items-center gap-1 text-sm text-destructive"
        role="status"
        title={message ?? undefined}
      >
        Couldn&apos;t save ·
        <Button variant="link" size="xs" className="px-0" onClick={() => void saveNow()}>
          Retry
        </Button>
      </span>
    );
  }
  const text = status === "saving" ? "Saving…" : dirty ? "Unsaved changes" : "Saved";
  return (
    <span className="text-sm text-muted-foreground" role="status">
      {text}
    </span>
  );
}
