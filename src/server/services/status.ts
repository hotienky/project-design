import { eq, sql } from "drizzle-orm";

import type { ComponentStatus } from "@/lib/design/status";
import type { Db } from "@/server/db/client";
import { componentStatus } from "@/server/db/schema";

export interface StatusInfo {
  status: ComponentStatus;
  note: string;
  updatedAt: Date;
}

export async function setComponentStatus(
  db: Db,
  projectId: string,
  nodeId: string,
  input: { status: ComponentStatus; note?: string },
  tokenId?: string | null,
): Promise<void> {
  const values = {
    status: input.status,
    note: input.note ?? "",
    updatedByTokenId: tokenId ?? null,
  };
  await db
    .insert(componentStatus)
    .values({ projectId, nodeId, ...values })
    .onConflictDoUpdate({
      target: [componentStatus.projectId, componentStatus.nodeId],
      set: { ...values, updatedAt: sql`now()` },
    });
}

/** Rows for nodes that no longer exist stay in the table; readers ignore them. */
export async function getStatuses(db: Db, projectId: string): Promise<Map<string, StatusInfo>> {
  const rows = await db
    .select()
    .from(componentStatus)
    .where(eq(componentStatus.projectId, projectId));
  return new Map(
    rows.map((r) => [r.nodeId, { status: r.status, note: r.note, updatedAt: r.updatedAt }]),
  );
}
