import { beforeEach, describe, expect, it } from "vitest";

import { getDb } from "@/server/db/client";
import { createProject } from "@/server/services/projects";
import { setComponentStatus, getStatuses } from "@/server/services/status";
import { createToken, listTokens, revokeToken, verifyToken } from "@/server/services/tokens";
import { resetDb } from "./helpers/db";

const db = getDb();

describe("tokens service", () => {
  beforeEach(resetDb);

  it("verifies, scopes and revokes tokens; the plaintext is never stored", async () => {
    const project = await createProject(db, { name: "P" });
    const all = await createToken(db, { name: "all" });
    const scoped = await createToken(db, { name: "scoped", projectId: project.id });

    expect(all.token).toMatch(/^pd_[A-Za-z0-9_-]{43}$/);
    expect(await verifyToken(db, all.token)).toEqual({ tokenId: all.id, projectId: null });
    expect(await verifyToken(db, scoped.token)).toEqual({
      tokenId: scoped.id,
      projectId: project.id,
    });
    expect(await verifyToken(db, "pd_unknown")).toBeNull();
    expect(await verifyToken(db, "not-a-token")).toBeNull();

    await revokeToken(db, all.id);
    expect(await verifyToken(db, all.token)).toBeNull();

    const rows = await listTokens(db);
    expect(JSON.stringify(rows)).not.toContain(scoped.token);
    expect(rows.find((r) => r.id === all.id)?.revokedAt).toBeInstanceOf(Date);
    expect(rows.find((r) => r.id === scoped.id)?.tokenPrefix).toBe(scoped.token.slice(0, 9));
  });
});

describe("status service", () => {
  beforeEach(resetDb);

  it("upserts one row per node and remembers who wrote it", async () => {
    const project = await createProject(db, { name: "P" });
    const token = await createToken(db, { name: "agent", projectId: project.id });

    await setComponentStatus(db, project.id, "svc_api", { status: "in_progress" }, token.id);
    await setComponentStatus(db, project.id, "svc_api", { status: "blocked", note: "no schema" });
    await setComponentStatus(db, project.id, "svc_web", { status: "done" });

    const statuses = await getStatuses(db, project.id);
    expect([...statuses.keys()].sort()).toEqual(["svc_api", "svc_web"]);
    expect(statuses.get("svc_api")).toMatchObject({ status: "blocked", note: "no schema" });
    expect(statuses.get("svc_web")?.updatedAt).toBeInstanceOf(Date);
  });
});
