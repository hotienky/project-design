// PROTOTYPE SUBSET — Phase 2 replaces this file with the full service (§8.2).
import { asc, eq } from "drizzle-orm";

import { parseDesign } from "@/lib/design/integrity";
import type { DesignDocumentInput } from "@/lib/design/schema";
import type { Db } from "@/server/db/client";
import { projects } from "@/server/db/schema";
import type { Principal } from "@/server/services/tokens";

export async function createProject(
  db: Db,
  input: { name: string; slug: string; description?: string; document: DesignDocumentInput },
) {
  const [row] = await db
    .insert(projects)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description ?? "",
      document: parseDesign(input.document),
    })
    .returning();
  return row;
}

export async function listProjects(db: Db, principal?: Principal) {
  const rows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      description: projects.description,
      revision: projects.revision,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .orderBy(asc(projects.name));
  return principal?.projectId ? rows.filter((r) => r.id === principal.projectId) : rows;
}

export async function getProjectBySlug(db: Db, slug: string) {
  const [row] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  return row ?? null;
}
