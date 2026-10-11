import { describe, expect, it } from "vitest";

import { ashenRealmsDesign } from "@/lib/design/examples/ashen-realms";
import { checkIntegrity, parseDesign, safeParseDesign } from "@/lib/design/integrity";
import { validateDesign } from "@/lib/design/validate";

describe("Ashen Realms example", () => {
  it("parses with no integrity errors", () => {
    const result = safeParseDesign(ashenRealmsDesign);
    expect(result.ok ? [] : result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.overview.mode).toBe("game");
      expect(checkIntegrity(result.document).filter((i) => i.severity === "error")).toEqual([]);
    }
  });

  it("has no validation errors or warnings", () => {
    const issues = validateDesign(parseDesign(ashenRealmsDesign));
    expect(issues.filter((i) => i.severity !== "info").map((i) => i.message)).toEqual([]);
  });
});
