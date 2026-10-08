import { describe, expect, it } from "vitest";

import { isValidSlug, slugify } from "@/lib/design/slug";

describe("slugify", () => {
  it.each([
    ["Team Tasks!", "team-tasks"],
    ["Ünïcödé", "unicode"],
    ["---", "project"],
    ["", "project"],
    ["  Spaces   and__underscores ", "spaces-and-underscores"],
    ["日本語", "project"],
  ])("%j → %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("cuts to 60 characters without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(59)} b`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("always produces a valid slug", () => {
    for (const name of ["x", "A-B", "a--b", "1 2 3", "é"])
      expect(isValidSlug(slugify(name))).toBe(true);
  });
});
