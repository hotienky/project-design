import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { readImport, toEnvelope, type ExportEnvelope } from "@/lib/design/export-format";
import { emptyDesign, type DesignDocument, type DesignDocumentInput } from "@/lib/design/schema";
import { parseDesign, safeParseDesign } from "@/lib/design/integrity";
import { isValidSlug, slugify } from "@/lib/design/slug";
import type { Db } from "@/server/db/client";
import { projects } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import type { Principal } from "@/server/services/tokens";
import { resolveDocument, type VersionRef } from "@/server/services/versions";

export type ProjectRow = typeof projects.$inferSelect;

const MAX_SLUG_ATTEMPTS = 50;

/** pg unique_violation, whether thrown raw or wrapped by Drizzle (cause). */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * The projects a principal may see: its user's, narrowed to one project for a scoped token.
 * No principal means a trusted internal caller (tests, scripts) that sees every project.
 */
export function visibleTo(principal?: Principal): SQL | undefined {
  if (!principal) return undefined;
  return and(
    eq(projects.ownerId, principal.userId),
    principal.projectId ? eq(projects.id, principal.projectId) : undefined,
  );
}

export async function listProjects(db: Db, principal?: Principal) {
  return db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      description: projects.description,
      revision: projects.revision,
      // Written out in full: Drizzle drops table qualifiers in single-table selects, which
      // would make the subquery compare project_versions columns with each other.
      latestVersion: sql<number | null>`(
        select max(v.version) from project_versions v where v.project_id = projects.id
      )`,
      nodeCount: sql<number>`jsonb_array_length(${projects.document}->'nodes')`.mapWith(Number),
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(visibleTo(principal))
    .orderBy(desc(projects.updatedAt));
}

/** The row, or null. Kept for callers that handle absence themselves. */
export async function getProjectBySlug(db: Db, slug: string, principal?: Principal) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), visibleTo(principal)))
    .limit(1);
  return row ?? null;
}

/** The row, or NOT_FOUND. A principal only sees its own projects (or its token's one project). */
export async function getProject(db: Db, slug: string, principal?: Principal): Promise<ProjectRow> {
  const row = await getProjectBySlug(db, slug, principal);
  if (!row) {
    throw new AppError("NOT_FOUND", `Unknown project "${slug}"`);
  }
  return row;
}

/** Just the draft revision (cheap: no document), or NOT_FOUND. Polled by open designers. */
export async function getDraftRevision(
  db: Db,
  slug: string,
  principal?: Principal,
): Promise<number> {
  const [row] = await db
    .select({ revision: projects.revision })
    .from(projects)
    .where(and(eq(projects.slug, slug), visibleTo(principal)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", `Unknown project "${slug}"`);
  return row.revision;
}

export async function createProject(
  db: Db,
  input: {
    name: string;
    slug?: string;
    description?: string;
    document?: DesignDocumentInput | DesignDocument;
    ownerId?: string | null;
  },
): Promise<ProjectRow> {
  const base = input.slug ?? slugify(input.name);
  if (!isValidSlug(base)) throw new AppError("VALIDATION", `Invalid slug "${base}"`);
  const document = parseDesign(input.document ?? emptyDesign());

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    try {
      const [row] = await db
        .insert(projects)
        .values({
          name: input.name,
          slug: attempt === 1 ? base : `${base}-${attempt}`,
          description: input.description ?? "",
          ownerId: input.ownerId ?? null,
          document,
        })
        .returning();
      return row!;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new AppError("CONFLICT", `Could not find a free slug starting with "${base}"`);
}

/** Renames or re-slugs a project. Does not bump the draft revision. */
export async function updateProjectMeta(
  db: Db,
  slug: string,
  patch: { name?: string; description?: string; slug?: string },
  principal?: Principal,
): Promise<ProjectRow> {
  if (patch.slug !== undefined && !isValidSlug(patch.slug)) {
    throw new AppError("VALIDATION", `Invalid slug "${patch.slug}"`);
  }
  const set = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
  };
  if (Object.keys(set).length === 0) return getProject(db, slug, principal);
  try {
    const [row] = await db
      .update(projects)
      .set(set)
      .where(and(eq(projects.slug, slug), visibleTo(principal)))
      .returning();
    if (!row) throw new AppError("NOT_FOUND", `Unknown project "${slug}"`);
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", `The slug "${patch.slug}" is already taken`);
    }
    throw error;
  }
}

/** Copies the draft only; versions, tokens and statuses are not copied. The copy belongs to the principal. */
export async function duplicateProject(
  db: Db,
  slug: string,
  input: { name: string },
  principal?: Principal,
): Promise<ProjectRow> {
  const source = await getProject(db, slug, principal);
  return createProject(db, {
    name: input.name,
    description: source.description,
    document: source.document,
    ownerId: principal?.userId ?? source.ownerId,
  });
}

export async function deleteProject(db: Db, slug: string, principal?: Principal): Promise<void> {
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.slug, slug), visibleTo(principal)))
    .returning({ id: projects.id });
  if (deleted.length === 0) throw new AppError("NOT_FOUND", `Unknown project "${slug}"`);
}

/** Stores a new draft if `revision` is still current. Optimistic concurrency. */
export async function saveDraft(
  db: Db,
  slug: string,
  input: { revision: number; document: unknown },
  principal?: Principal,
): Promise<{ revision: number; updatedAt: Date }> {
  const parsed = safeParseDesign(input.document);
  if (!parsed.ok) throw new AppError("VALIDATION", "The design is invalid", parsed.issues);

  const [row] = await db
    .update(projects)
    .set({
      document: parsed.document,
      revision: sql`${projects.revision} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      and(eq(projects.slug, slug), eq(projects.revision, input.revision), visibleTo(principal)),
    )
    .returning({ revision: projects.revision, updatedAt: projects.updatedAt });
  if (row) return row;

  const current = await getProjectBySlug(db, slug, principal);
  if (!current) throw new AppError("NOT_FOUND", `Unknown project "${slug}"`);
  throw new AppError("CONFLICT", "The design was changed elsewhere", {
    currentRevision: current.revision,
  });
}

/** Creates a project from an export envelope or bare document, owned by the principal's user. */
export async function importProject(
  db: Db,
  json: unknown,
  principal?: Principal,
): Promise<ProjectRow> {
  const { project, document } = readImport(json);
  const parsed = safeParseDesign(document);
  if (!parsed.ok) throw new AppError("VALIDATION", "The file is not a valid design", parsed.issues);
  return createProject(db, {
    name: project?.name ?? "Imported design",
    slug: project && isValidSlug(project.slug) ? project.slug : undefined,
    description: project?.description,
    document: parsed.document,
    ownerId: principal?.userId,
  });
}

export async function exportProject(
  db: Db,
  slug: string,
  ref: VersionRef,
  principal?: Principal,
): Promise<ExportEnvelope> {
  const { project, document, version } = await resolveDocument(db, slug, ref, principal);
  return toEnvelope(project, document, version);
}
