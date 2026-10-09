import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getDesign } from "@/app/api/projects/[slug]/design/route";
import { GET as signIn } from "@/app/api/auth/github/route";
import { LOCAL_GITHUB_ID, getLocalUser, upsertGithubUser } from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";
import { createProject, getProject } from "@/server/services/projects";
import { createToken, verifyToken } from "@/server/services/tokens";
import { resetDb } from "./helpers/db";

// Local mode: no GitHub credentials. Route handlers run outside Next, so stub its request APIs.
vi.mock("@/server/auth/github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/github")>()),
  isLocalMode: () => true,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const db = getDb();
const as = (userId: string) => ({ userId, tokenId: null, projectId: null });

describe("local mode", () => {
  beforeEach(resetDb);

  it("acts as the built-in local user without any cookie", async () => {
    const local = await getLocalUser(db);
    await createProject(db, { name: "P", ownerId: local.id });
    const res = await getDesign(new Request("http://localhost/x"), {
      params: Promise.resolve({ slug: "p" }),
    });
    expect(res.status).toBe(200);
    expect(local.githubId).toBe(LOCAL_GITHUB_ID);
    expect((await getLocalUser(db)).id).toBe(local.id);
  });

  it("sends 'sign in' straight to the app", async () => {
    const res = await signIn(new Request("http://localhost/api/auth/github?next=/settings"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/settings");
  });

  it("claims data from before sign-in, and hands everything to the first GitHub account", async () => {
    await createProject(db, { name: "Legacy" });
    const local = await getLocalUser(db);
    expect((await getProject(db, "legacy", as(local.id))).ownerId).toBe(local.id);

    await createProject(db, { name: "Made locally", ownerId: local.id });
    const { token } = await createToken(db, { name: "agent", userId: local.id });

    const alice = await upsertGithubUser(db, { id: 1, login: "alice" });
    for (const slug of ["legacy", "made-locally"]) {
      expect((await getProject(db, slug, as(alice.id))).ownerId).toBe(alice.id);
    }
    expect((await verifyToken(db, token))?.userId).toBe(alice.id);

    // Only the first GitHub account takes over.
    await createProject(db, { name: "Later", ownerId: local.id });
    await upsertGithubUser(db, { id: 2, login: "bob" });
    expect((await getProject(db, "later", as(local.id))).ownerId).toBe(local.id);
  });

  it("does not claim legacy data once a GitHub account exists", async () => {
    const alice = await upsertGithubUser(db, { id: 1, login: "alice" });
    await createProject(db, { name: "Orphan" });
    const local = await getLocalUser(db);
    await expect(getProject(db, "orphan", as(local.id))).rejects.toThrow();
    await expect(getProject(db, "orphan", as(alice.id))).rejects.toThrow();
  });
});
