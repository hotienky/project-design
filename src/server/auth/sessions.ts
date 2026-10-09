import { createHash, randomBytes } from "node:crypto";

import { and, count, eq, gt, isNull, lt, ne, or } from "drizzle-orm";

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

/** The built-in user of local mode (no GitHub credentials). GitHub ids are numeric, so no clash. */
export const LOCAL_GITHUB_ID = "local";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Hands projects and MCP tokens with no owner, or owned by `fromUserId`, to `userId`. */
async function claim(tx: Tx, userId: string, fromUserId?: string) {
  const projectFrom = fromUserId
    ? or(isNull(projects.ownerId), eq(projects.ownerId, fromUserId))
    : isNull(projects.ownerId);
  const tokenFrom = fromUserId
    ? or(isNull(apiTokens.userId), eq(apiTokens.userId, fromUserId))
    : isNull(apiTokens.userId);
  await tx.update(projects).set({ ownerId: userId }).where(projectFrom);
  await tx.update(apiTokens).set({ userId }).where(tokenFrom);
}

/**
 * Creates or refreshes the user for a GitHub account. The first GitHub account to sign in claims
 * what the install had before: projects and MCP tokens from before sign-in existed, and
 * everything the local-mode user made. A self-hosted install keeps its data when it adds GitHub.
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
    const [{ total }] = await tx
      .select({ total: count() })
      .from(users)
      .where(ne(users.githubId, LOCAL_GITHUB_ID));
    if (total === 1) {
      const [local] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.githubId, LOCAL_GITHUB_ID));
      await claim(tx, user!.id, local?.id);
    }
    return user!;
  });
}

/**
 * The single user every request acts as in local mode, created on first use. On creation it
 * claims the projects and tokens from before sign-in existed, unless a GitHub account already has.
 */
export async function getLocalUser(db: Db): Promise<UserRow> {
  const [existing] = await db.select().from(users).where(eq(users.githubId, LOCAL_GITHUB_ID));
  if (existing) return existing;
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ githubId: LOCAL_GITHUB_ID, login: "local", name: "Local user" })
      .onConflictDoNothing({ target: users.githubId })
      .returning();
    if (!created) {
      // Another request created it first.
      const [row] = await tx.select().from(users).where(eq(users.githubId, LOCAL_GITHUB_ID));
      return row!;
    }
    const [{ total }] = await tx
      .select({ total: count() })
      .from(users)
      .where(ne(users.githubId, LOCAL_GITHUB_ID));
    if (total === 0) await claim(tx, created.id);
    return created;
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
