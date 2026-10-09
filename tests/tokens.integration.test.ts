import { beforeEach, describe, expect, it } from "vitest";

import { getDb } from "@/server/db/client";
import { createProject } from "@/server/services/projects";
import { setComponentStatus, getStatuses } from "@/server/services/status";
import { createToken, listTokens, revokeToken, verifyToken } from "@/server/services/tokens";
import { resetDb, testUser } from "./helpers/db";

const db = getDb();

describe("tokens service", () => {
  beforeEach(resetDb);

  it("verifies, scopes and revokes tokens; the plaintext is never stored", async () => {
    const user = await testUser();
    const project = await createProject(db, { name: "P", ownerId: user.id });
    const all = await createToken(db, { name: "all", userId: user.id });
    const scoped = await createToken(db, {
      name: "scoped",
      userId: user.id,
      projectId: project.id,
    });

    expect(all.token).toMatch(/^pd_[A-Za-z0-9_-]{43}$/);
    expect(await verifyToken(db, all.token)).toEqual({
      userId: user.id,
      tokenId: all.id,
      projectId: null,
    });
    expect(await verifyToken(db, scoped.token)).toEqual({
      userId: user.id,
      tokenId: scoped.id,
      projectId: project.id,
    });
    expect(await verifyToken(db, "pd_unknown")).toBeNull();
    expect(await verifyToken(db, "not-a-token")).toBeNull();

    // Another user can't revoke it.
    await revokeToken(db, all.id, (await testUser("bob", 2)).id);
    expect(await verifyToken(db, all.token)).not.toBeNull();
    await revokeToken(db, all.id, user.id);
    expect(await verifyToken(db, all.token)).toBeNull();

    expect(await listTokens(db, (await testUser("bob", 2)).id)).toEqual([]);
    const rows = await listTokens(db, user.id);
    expect(JSON.stringify(rows)).not.toContain(scoped.token);
    expect(rows.find((r) => r.id === all.id)?.revokedAt).toBeInstanceOf(Date);
    expect(rows.find((r) => r.id === scoped.id)?.tokenPrefix).toBe(scoped.token.slice(0, 9));
  });
});

describe("status service", () => {
  beforeEach(resetDb);

  it("upserts one row per node and remembers who wrote it", async () => {
    const project = await createProject(db, { name: "P" });
    const token = await createToken(db, {
      name: "agent",
      userId: (await testUser()).id,
      projectId: project.id,
    });

    await setComponentStatus(db, project.id, "svc_api", { status: "in_progress" }, token.id);
    await setComponentStatus(db, project.id, "svc_api", { status: "blocked", note: "no schema" });
    await setComponentStatus(db, project.id, "svc_web", { status: "done" });

    const statuses = await getStatuses(db, project.id);
    expect([...statuses.keys()].sort()).toEqual(["svc_api", "svc_web"]);
    expect(statuses.get("svc_api")).toMatchObject({ status: "blocked", note: "no schema" });
    expect(statuses.get("svc_web")?.updatedAt).toBeInstanceOf(Date);
  });
});
