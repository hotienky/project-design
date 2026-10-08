import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import type { Db } from "@/server/db/client";
import { apiTokens } from "@/server/db/schema";

const TOKEN_PREFIX = "pd_";
// last_used_at is informational; don't write it on every MCP request.
const TOUCH_INTERVAL_MS = 60_000;

export interface Principal {
  tokenId: string;
  /** null = may see every project. */
  projectId: string | null;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a token and returns the plaintext once; only its hash is stored. */
export async function createToken(
  db: Db,
  input: { name: string; projectId?: string | null },
): Promise<{ token: string; id: string }> {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const [row] = await db
    .insert(apiTokens)
    .values({
      name: input.name,
      tokenHash: hashToken(token),
      tokenPrefix: token.slice(0, TOKEN_PREFIX.length + 6),
      projectId: input.projectId ?? null,
    })
    .returning({ id: apiTokens.id });
  return { token, id: row.id };
}

export async function verifyToken(db: Db, token: string): Promise<Principal | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const [row] = await db
    .select({ id: apiTokens.id, projectId: apiTokens.projectId })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashToken(token)), isNull(apiTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(apiTokens.id, row.id),
        or(
          isNull(apiTokens.lastUsedAt),
          lt(apiTokens.lastUsedAt, new Date(Date.now() - TOUCH_INTERVAL_MS)),
        ),
      ),
    );
  return { tokenId: row.id, projectId: row.projectId };
}

export async function listTokens(db: Db) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      projectId: apiTokens.projectId,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .orderBy(desc(apiTokens.createdAt));
}

export async function revokeToken(db: Db, id: string): Promise<void> {
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)));
}
