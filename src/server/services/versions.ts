import { and, desc, eq, sql } from "drizzle-orm";

import { diffDesigns } from "@/lib/design/diff";
import type { DesignDocument } from "@/lib/design/schema";
import type { Db } from "@/server/db/client";
import { projectVersions, projects } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { getProject, saveDraft, visibleTo } from "@/server/services/projects";
import type { Principal } from "@/server/services/tokens";

export type VersionRef = "draft" | "latest" | number;

export interface ResolvedDocument {
  project: { id: string; slug: string; name: string; description: string };
  document: DesignDocument;
  /** Draft revision, or the revision a published version was taken from. */
  revision: number;
  version: { number: number; label: string } | null;
}

export async function publishVersion(
  db: Db,
  slug: string,
  input: { label?: string; notes?: string },
  principal?: Principal,
): Promise<{ version: number; createdAt: Date }> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.slug, slug), visibleTo(principal)))
      .for("update")
      .limit(1);
    if (!project) throw new AppError("NOT_FOUND", `Unknown project "${slug}"`);

    const [latest] = await tx
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, project.id))
      .orderBy(desc(projectVersions.version))
      .limit(1);
    if (latest && diffDesigns(latest.document, project.document).isEmpty) {
      throw new AppError("VALIDATION", `No changes since version ${latest.version}`);
    }
    const [row] = await tx
      .insert(projectVersions)
      .values({
        projectId: project.id,
        version: (latest?.version ?? 0) + 1,
        label: input.label ?? "",
        notes: input.notes ?? "",
        document: project.document,
        sourceRevision: project.revision,
      })
      .returning({ version: projectVersions.version, createdAt: projectVersions.createdAt });
    return row!;
  });
}

export async function listVersions(db: Db, slug: string, principal?: Principal) {
  const project = await getProject(db, slug, principal);
  return db
    .select({
      version: projectVersions.version,
      label: projectVersions.label,
      notes: projectVersions.notes,
      sourceRevision: projectVersions.sourceRevision,
      createdAt: projectVersions.createdAt,
      nodeCount: sql<number>`jsonb_array_length(${projectVersions.document}->'nodes')`.mapWith(
        Number,
      ),
    })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, project.id))
    .orderBy(desc(projectVersions.version));
}

export async function getVersion(db: Db, slug: string, version: number, principal?: Principal) {
  const project = await getProject(db, slug, principal);
  const [row] = await db
    .select()
    .from(projectVersions)
    .where(and(eq(projectVersions.projectId, project.id), eq(projectVersions.version, version)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", `Project "${slug}" has no version ${version}`);
  return row;
}

export async function resolveDocument(
  db: Db,
  slug: string,
  ref: VersionRef,
  principal?: Principal,
): Promise<ResolvedDocument> {
  const project = await getProject(db, slug, principal);
  const meta = {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
  };
  if (ref === "draft") {
    return { project: meta, document: project.document, revision: project.revision, version: null };
  }
  let row;
  if (ref === "latest") {
    [row] = await db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, project.id))
      .orderBy(desc(projectVersions.version))
      .limit(1);
    if (!row) {
      throw new AppError("NOT_FOUND", 'No published version yet; use version "draft"');
    }
  } else {
    row = await getVersion(db, slug, ref, principal);
  }
  return {
    project: meta,
    document: row.document,
    revision: row.sourceRevision,
    version: { number: row.version, label: row.label },
  };
}

/** Replaces the draft with a published version's document (same revision rules as any save). */
export async function restoreVersion(
  db: Db,
  slug: string,
  version: number,
  input: { revision: number },
  principal?: Principal,
): Promise<{ revision: number; document: DesignDocument }> {
  const row = await getVersion(db, slug, version, principal);
  const saved = await saveDraft(
    db,
    slug,
    { revision: input.revision, document: row.document },
    principal,
  );
  return { revision: saved.revision, document: row.document };
}
