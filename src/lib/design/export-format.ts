/** The file format of exported/imported designs. */
import { z } from "zod";

import type { DesignDocument } from "@/lib/design/schema";

export const ExportEnvelopeSchema = z.object({
  format: z.literal("project-design"),
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  project: z.object({
    name: z.string().min(1).max(120),
    slug: z.string(),
    description: z.string().default(""),
  }),
  version: z.object({ number: z.number().int().positive(), label: z.string() }).nullable(),
  document: z.unknown(), // validated separately with safeParseDesign
});
export type ExportEnvelope = z.output<typeof ExportEnvelopeSchema>;

export interface ImportedProject {
  name: string;
  slug: string;
  description: string;
}

export function toEnvelope(
  project: ImportedProject,
  document: DesignDocument,
  version: { number: number; label: string } | null,
): ExportEnvelope {
  return {
    format: "project-design",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project: { name: project.name, slug: project.slug, description: project.description },
    version,
    document,
  };
}

/** Accepts an envelope or a bare document ({ schemaVersion: 1, … }). Throws ZodError for a bad envelope. */
export function readImport(json: unknown): { project: ImportedProject | null; document: unknown } {
  if (typeof json === "object" && json !== null && "format" in json) {
    const envelope = ExportEnvelopeSchema.parse(json);
    return { project: envelope.project, document: envelope.document };
  }
  return { project: null, document: json };
}
