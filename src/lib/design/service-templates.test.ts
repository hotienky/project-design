import { describe, expect, it } from "vitest";

import { applyServiceTemplate } from "@/lib/design/edits";
import { parseDesign, safeParseDesign } from "@/lib/design/integrity";
import { indexDesign } from "@/lib/design/graph";
import { SERVICE_TEMPLATES, getServiceTemplate } from "@/lib/design/service-templates";
import { validateDesign } from "@/lib/design/validate";

const withService = (data: object = {}) =>
  parseDesign({
    schemaVersion: 1,
    nodes: [{ id: "svc_a", kind: "service", name: "Orders", data }],
  });

describe("service templates", () => {
  it("covers the requested ecosystems with unique ids", () => {
    const ids = SERVICE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SERVICE_TEMPLATES.map((t) => t.language)).toEqual(
      expect.arrayContaining(["C#", "TypeScript", "Go", "Rust", "Java"]),
    );
  });

  it.each(SERVICE_TEMPLATES.map((t) => [t.id]))("%s only references its own layers", (id) => {
    const t = getServiceTemplate(id)!;
    const keys = new Set(t.layers.map((l) => l.key));
    expect(keys.size).toBe(t.layers.length);
    for (const l of t.layers) for (const d of l.dependsOn) expect(keys).toContain(d);
  });

  it.each(SERVICE_TEMPLATES.map((t) => [t.id]))("%s produces a valid, clean design", (id) => {
    const { document, added } = applyServiceTemplate(withService(), "svc_a", id);
    const t = getServiceTemplate(id)!;
    expect(safeParseDesign(document).ok).toBe(true);
    expect(added).toEqual({
      stack: t.stack.length,
      conventions: t.conventions.length,
      layers: t.layers.length,
      env: t.env.length,
    });
    const svc = document.nodes.find((n) => n.id === "svc_a")!;
    expect(svc.kind === "service" && svc.data.language).toBe(t.language);
    expect(svc.kind === "service" && svc.data.path).toBe(t.defaultPath);
    expect(indexDesign(document).children("svc_a")).toHaveLength(t.layers.length);
    // Language comes from the scoped stack item, so no project-wide language is needed.
    expect(validateDesign(document).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("keeps existing content and is idempotent", () => {
    const once = applyServiceTemplate(
      withService({ path: "apps/orders", port: 9000 }),
      "svc_a",
      "go-service",
    ).document;
    const svc = once.nodes.find((n) => n.id === "svc_a");
    expect(svc?.kind === "service" && [svc.data.path, svc.data.port]).toEqual([
      "apps/orders",
      9000,
    ]);
    const layer = once.nodes.find((n) => n.kind === "layer");
    expect(layer?.kind === "layer" && layer.data.path).toMatch(/^apps\/orders\/internal\//);

    const twice = applyServiceTemplate(once, "svc_a", "go-service");
    expect(twice.added).toEqual({ stack: 0, conventions: 0, layers: 0, env: 0 });
    expect(twice.document.nodes).toHaveLength(once.nodes.length);
  });

  it("ignores unknown templates and non-service nodes", () => {
    const doc = withService();
    expect(applyServiceTemplate(doc, "svc_a", "nope").document).toBe(doc);
    expect(applyServiceTemplate(doc, "missing", "go-service").document).toBe(doc);
  });
});
