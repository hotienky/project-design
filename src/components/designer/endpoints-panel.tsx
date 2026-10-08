"use client";

import { useMemo } from "react";

import { useDesigner } from "@/components/designer/store-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { endpointsOf, type EndpointGroup } from "@/lib/design/levels";
import type { DesignNode } from "@/lib/design/schema";
import { useSelection } from "@/stores/selection-store";

function Group({ group }: { group: EndpointGroup }) {
  const { api, operations, whole } = group;
  return (
    <div className="px-2 py-1.5">
      <button
        type="button"
        className="flex w-full items-baseline gap-1.5 rounded-lg px-2 pb-1 text-left text-xs hover:bg-muted"
        onClick={() => useSelection.getState().set([api.id], [])}
      >
        <span className="font-semibold">{api.name}</span>
        <span className="text-muted-foreground">
          {api.data.style}
          {whole ? " · whole API" : ` · ${operations.length} of ${api.data.operations.length}`}
        </span>
      </button>
      {operations.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">The API has no operations yet.</p>
      ) : (
        <ul>
          {operations.map((op) => (
            <li key={op.id}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-muted"
                title={op.summary || op.name}
                onClick={() => useSelection.getState().set([api.id], [])}
              >
                <span className="w-12 shrink-0 font-mono text-[10px] leading-4 font-semibold text-sky-600 dark:text-sky-400">
                  {op.method ?? api.data.style}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono">
                    {op.path !== null ? `${api.data.basePath}${op.path}` : op.name}
                  </span>
                  {op.path !== null && (
                    <span className="block truncate text-muted-foreground">{op.name}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The endpoints a focused module (a controller, say) implements and calls. */
export function EndpointsPanel({ focus }: { focus: DesignNode }) {
  const document = useDesigner((s) => s.document);
  const { implements: implemented, calls } = useMemo(
    () => endpointsOf(document, focus.id),
    [document, focus.id],
  );
  const total = [...implemented, ...calls].reduce((n, g) => n + g.operations.length, 0);
  return (
    <section
      aria-label="Endpoints"
      className="flex max-h-[min(28rem,calc(100vh-12rem))] w-90 flex-col overflow-hidden rounded-xl border bg-background shadow-lg shadow-black/5"
    >
      <header className="border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Endpoints</h2>
        <p className="text-xs text-muted-foreground">
          {total === 0 ? focus.name : `${focus.name} · ${total} operations`}
        </p>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {implemented.length === 0 && calls.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {focus.name} implements no API yet. Connect it to an API with an “exposes” edge, then
            pick the operations it implements in the inspector.
          </p>
        )}
        {implemented.length > 0 && (
          <div className="py-1">
            <h3 className="px-4 pt-1 text-xs font-semibold text-muted-foreground">Implements</h3>
            {implemented.map((g) => (
              <Group key={g.edgeId} group={g} />
            ))}
          </div>
        )}
        {calls.length > 0 && (
          <div className="py-1">
            <h3 className="px-4 pt-1 text-xs font-semibold text-muted-foreground">Calls</h3>
            {calls.map((g) => (
              <Group key={g.edgeId} group={g} />
            ))}
          </div>
        )}
      </ScrollArea>
    </section>
  );
}
