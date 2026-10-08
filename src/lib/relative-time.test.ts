import { describe, expect, it } from "vitest";

import { formatRelative } from "@/lib/relative-time";

const now = new Date("2026-10-08T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("formatRelative", () => {
  it.each([
    [10, "just now"],
    [120, "2 minutes ago"],
    [2 * 3600, "2 hours ago"],
    [26 * 3600, "yesterday"],
    [3 * 24 * 3600, "3 days ago"],
    [70 * 24 * 3600, "2 months ago"],
    [400 * 24 * 3600, "last year"],
  ])("%d s ago → %s", (seconds, expected) => {
    expect(formatRelative(ago(seconds), now)).toBe(expected);
  });

  it("handles the future", () => {
    expect(formatRelative(new Date(now.getTime() + 3 * 3600 * 1000), now)).toBe("in 3 hours");
  });
});
