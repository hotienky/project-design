import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/server/auth/github";

describe("safeNextPath", () => {
  it("keeps same-site paths and rejects everything else", () => {
    expect(safeNextPath("/projects/x?y=1")).toBe("/projects/x?y=1");
    expect(safeNextPath("/settings")).toBe("/settings");
    for (const bad of [
      null,
      undefined,
      "",
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "projects",
    ]) {
      expect(safeNextPath(bad)).toBe("/projects");
    }
  });
});
