"use client";

import { useEffect, useState } from "react";

import { diffDesigns, renderDiffMarkdown } from "@/lib/design/diff";
import { ExportEnvelopeSchema } from "@/lib/design/export-format";
import { indexDesign } from "@/lib/design/graph";
import { safeParseDesign } from "@/lib/design/integrity";
import type { DesignDocument } from "@/lib/design/schema";

/** What changed between a published version and the current draft, as plain text. */
export function DiffView({
  slug,
  version,
  draft,
}: {
  slug: string;
  version: number;
  draft: DesignDocument;
}) {
  const [state, setState] = useState<
    { version: number; text: string } | { version: number; error: string } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/export?version=${version}`);
        if (!response.ok) throw new Error("fetch failed");
        const envelope = ExportEnvelopeSchema.parse(await response.json());
        const parsed = safeParseDesign(envelope.document);
        if (!parsed.ok) throw new Error("invalid version");
        const diff = diffDesigns(parsed.document, draft);
        const text = renderDiffMarkdown(diff, indexDesign(draft), indexDesign(parsed.document));
        if (!cancelled) setState({ version, text });
      } catch {
        if (!cancelled) setState({ version, error: "Couldn't load that version." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, version, draft]);

  if (!state || state.version !== version)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if ("error" in state) return <p className="text-sm text-destructive">{state.error}</p>;
  return (
    <pre
      data-testid="diff"
      className="max-h-[60dvh] overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap"
    >
      {state.text}
    </pre>
  );
}
