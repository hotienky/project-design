"use client";

import { AlertTriangle, CircleAlert, Info, X } from "lucide-react";
import { useMemo } from "react";

import { useCanvasActions } from "@/components/designer/canvas-actions";
import { useDesigner } from "@/components/designer/store-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Issue } from "@/lib/design/integrity";
import { validateDesign } from "@/lib/design/validate";
import { useCanvasUi } from "@/stores/canvas-ui-store";
import { useSelection } from "@/stores/selection-store";

const ICON = {
  error: <CircleAlert className="size-4 shrink-0 text-red-500" aria-label="Error" />,
  warning: <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-label="Warning" />,
  info: <Info className="size-4 shrink-0 text-sky-500" aria-label="Info" />,
};
const TITLES = { error: "Errors", warning: "Warnings", info: "Hints" } as const;

export function ValidationPanel() {
  const document = useDesigner((s) => s.document);
  const actions = useCanvasActions();
  const issues = useMemo(() => validateDesign(document), [document]);

  function open(issue: Issue) {
    if (issue.nodeId) useSelection.getState().set([issue.nodeId], []);
    else if (issue.edgeId) useSelection.getState().set([], [issue.edgeId]);
    else return;
    actions.focus({ nodeId: issue.nodeId, edgeId: issue.edgeId });
  }

  return (
    <section
      aria-label="Validation"
      className="flex h-70 w-90 flex-col rounded-lg border bg-background shadow-md"
    >
      <header className="flex items-center justify-between border-b px-3 py-1.5">
        <h2 className="text-sm font-medium">Validation</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close validation panel"
          onClick={() => useCanvasUi.getState().toggleValidation(false)}
        >
          <X />
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {issues.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No problems found.</p>
        ) : (
          (["error", "warning", "info"] as const).map((severity) => {
            const group = issues.filter((i) => i.severity === severity);
            if (group.length === 0) return null;
            return (
              <div key={severity} className="p-1.5">
                <h3 className="px-1.5 pb-1 text-xs font-medium text-muted-foreground uppercase">
                  {TITLES[severity]} ({group.length})
                </h3>
                <ul>
                  {group.map((issue, i) => {
                    const clickable = issue.nodeId || issue.edgeId;
                    return (
                      <li key={`${issue.code}-${i}`}>
                        <button
                          type="button"
                          disabled={!clickable}
                          className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left text-xs enabled:hover:bg-muted"
                          onClick={() => open(issue)}
                        >
                          {ICON[severity]}
                          <span>{issue.message}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </ScrollArea>
    </section>
  );
}
