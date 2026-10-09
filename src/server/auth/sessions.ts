import { createHash, randomBytes } from "node:crypto";

import { and, count, eq, gt, isNull, lt } from "drizzle-orm";

import type { Db } from "@/server/db/client";
import { apiTokens, projects, sessions, users } from "@/server/db/schema";

export const SESSION_COOKIE = "pd_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type UserRow = typeof users.$inferSelect;

export interface GithubProfile {
  id: number | string;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Creates or refreshes the user for a GitHub account. The first user to sign in claims the
 * projects and MCP tokens made before sign-in existed, so a self-hosted install keeps its data.
 */
export async function upsertGithubUser(db: Db, profile: GithubProfile): Promise<UserRow> {
  return db.transaction(async (tx) => {
    const values = {
      githubId: String(profile.id),
      login: profile.login,
      name: profile.name ?? "",
      avatarUrl: profile.avatar_url ?? "",
    };
    const [user] = await tx
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.githubId,
        set: { login: values.login, name: values.name, avatarUrl: values.avatarUrl },
      })
      .returning();
    const [{ total }] = await tx.select({ total: count() }).from(users);
    if (total === 1) {
      await tx.update(projects).set({ ownerId: user!.id }).where(isNull(projects.ownerId));
      await tx.update(apiTokens).set({ userId: user!.id }).where(isNull(apiTokens.userId));
    }
    return user!;
  });
}

/** Starts a session and returns the cookie value once; only its hash is stored. */
export async function createSession(
  db: Db,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hash(token), userId, expiresAt });
  // Opportunistic cleanup, so expired rows don't pile up.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

/** The signed-in user for a session cookie value, or null when unknown or expired. */
export async function getSessionUser(db: Db, token: string): Promise<UserRow | null> {
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row?.user ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  if (token) await db.delete(sessions).where(eq(sessions.id, hash(token)));
}
