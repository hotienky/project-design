import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createSession,
  deleteSession,
  getSessionUser,
  upsertGithubUser,
} from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { createProject, getProject } from "@/server/services/projects";
import { createToken, verifyToken } from "@/server/services/tokens";
import { resetDb } from "./helpers/db";

const db = getDb();

describe("GitHub users and sessions", () => {
  beforeEach(resetDb);

  it("upserts by GitHub id and refreshes the profile", async () => {
    const first = await upsertGithubUser(db, { id: 7, login: "octo", name: "Octo" });
    const again = await upsertGithubUser(db, {
      id: 7,
      login: "octo-renamed",
      avatar_url: "https://avatars.example/7",
    });
    expect(again.id).toBe(first.id);
    expect(again).toMatchObject({
      login: "octo-renamed",
      name: "",
      avatarUrl: "https://avatars.example/7",
    });
  });

  it("gives data from before sign-in to the first user only", async () => {
    const legacy = await createProject(db, { name: "Legacy" });
    // Tokens from before sign-in have no user and act for nobody until claimed.
    const token = "pd_" + "a".repeat(43);
    await db.execute(
      sql`insert into api_tokens (name, token_hash, token_prefix)
          values ('old', encode(sha256(convert_to(${token}, 'UTF8')), 'hex'), 'pd_aaaaaa')`,
    );
    expect(await verifyToken(db, token)).toBeNull();

    const alice = await upsertGithubUser(db, { id: 1, login: "alice" });
    const principal = { userId: alice.id, tokenId: null, projectId: null };
    expect((await getProject(db, "legacy", principal)).id).toBe(legacy.id);
    expect((await verifyToken(db, token))?.userId).toBe(alice.id);

    await createProject(db, { name: "Orphan" });
    const bob = await upsertGithubUser(db, { id: 2, login: "bob" });
    await expect(
      getProject(db, "orphan", { userId: bob.id, tokenId: null, projectId: null }),
    ).rejects.toThrow();
    await expect(getProject(db, "orphan", principal)).rejects.toThrow();
  });

  it("creates, resolves, expires and deletes sessions; only hashes are stored", async () => {
    const user = await upsertGithubUser(db, { id: 1, login: "alice" });
    const { token, expiresAt } = await createSession(db, user.id);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
    expect((await getSessionUser(db, token))?.id).toBe(user.id);
    expect(await getSessionUser(db, "nope")).toBeNull();
    expect(await getSessionUser(db, "")).toBeNull();
    const rows = await db.select().from(sessions);
    expect(JSON.stringify(rows)).not.toContain(token);

    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.userId, user.id));
    expect(await getSessionUser(db, token)).toBeNull();

    const second = await createSession(db, user.id);
    // Creating a session prunes expired ones.
    expect(await db.select().from(sessions)).toHaveLength(1);
    await deleteSession(db, second.token);
    expect(await getSessionUser(db, second.token)).toBeNull();
  });

  it("scopes MCP tokens to their user's projects", async () => {
    const alice = await upsertGithubUser(db, { id: 1, login: "alice" });
    const bob = await upsertGithubUser(db, { id: 2, login: "bob" });
    await createProject(db, { name: "A", ownerId: alice.id });
    const { token } = await createToken(db, { name: "bob", userId: bob.id });
    const principal = await verifyToken(db, token);
    await expect(getProject(db, "a", principal!)).rejects.toThrow();
  });
});
