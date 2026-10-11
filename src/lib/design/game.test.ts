import { describe, expect, it } from "vitest";

import { renderBrief } from "@/lib/design/brief";
import { buildPlan } from "@/lib/design/build-plan";
import { diffDesigns } from "@/lib/design/diff";
import { removeElements } from "@/lib/design/edits";
import { indexDesign } from "@/lib/design/graph";
import { checkIntegrity, parseDesign, safeParseDesign } from "@/lib/design/integrity";
import { emptyDesign, type DesignDocumentInput } from "@/lib/design/schema";
import { validateDesign } from "@/lib/design/validate";

const n = (id: string, kind: string, extra: Record<string, unknown> = {}) =>
  ({ id, kind, name: id, description: "d", ...extra }) as never;
const e = (id: string, kind: string, source: string, target: string, data = {}) =>
  ({ id, kind, source, target, data }) as never;

/** A tiny combat/loot economy: one loop, two systems, a mechanic, a currency and a table. */
const game: DesignDocumentInput = {
  schemaVersion: 1,
  overview: {
    mode: "game",
    summary: "Co-op ARPG",
    game: {
      genre: "Action RPG",
      engine: "Unity 6",
      pillars: ["Solo first, co-op adds tactics"],
      parameters: [{ name: "Players", value: "1–4" }],
      targets: [{ name: "Server tick", value: "30", unit: "Hz" }],
    },
  },
  milestones: [
    { id: "ms_one", title: "Foundation", timeframe: "Weeks 1–3", scope: ["sys_combat"] },
  ],
  nodes: [
    n("lop_combat", "loop", { data: { duration: "5–30 s", steps: ["Dodge", "Hit"] } }),
    n("sys_combat", "system", { data: { category: "combat", authority: "server" } }),
    n("mec_dmg", "mechanic", {
      parentId: "sys_combat",
      data: { formulas: [{ name: "Mitigation", expression: "D × 100 / (100 + A)" }] },
    }),
    n("sys_loot", "system", { data: { category: "items" } }),
    n("res_gold", "resource", { data: { type: "currency", initial: "0" } }),
    n("cnt_rarity", "content", {
      parentId: "sys_loot",
      data: { columns: ["Rarity", "Modifiers"], rows: [["Rare", "2–3"]] },
    }),
  ],
  edges: [
    e("e_drive", "drives", "lop_combat", "sys_combat"),
    e("e_trig", "triggers", "sys_combat", "sys_loot", { event: "enemy defeated" }),
    e("e_gold", "produces", "sys_loot", "res_gold", { rate: "on kill" }),
    e("e_dep", "depends_on", "sys_loot", "sys_combat"),
    e("e_uses", "uses", "sys_loot", "cnt_rarity"),
  ],
};

describe("game design mode", () => {
  it("keeps old documents valid and defaults to software mode", () => {
    const doc = emptyDesign();
    expect(doc.overview.mode).toBe("software");
    expect(doc.milestones).toEqual([]);
    expect(doc.overview.game.pillars).toEqual([]);
  });

  it("parses a game design with no integrity errors", () => {
    expect(checkIntegrity(parseDesign(game))).toEqual([]);
  });

  it("enforces containment and edge rules for game kinds", () => {
    const bad = safeParseDesign({
      ...game,
      nodes: [...game.nodes!, n("mec_orphan", "mechanic")],
      edges: [...game.edges!, e("e_bad", "produces", "lop_combat", "res_gold")],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues).toHaveLength(2);
  });

  it("rejects milestone scopes that point at unknown nodes", () => {
    const doc = parseDesign(game);
    doc.milestones[0]!.scope = ["sys_missing"];
    expect(checkIntegrity(doc).map((i) => i.code)).toContain("scope.unknown_node");
  });

  it("clears milestone scopes when a node is removed", () => {
    const doc = removeElements(parseDesign(game), { nodeIds: ["sys_combat"] });
    expect(doc.milestones[0]!.scope).toEqual([]);
    expect(checkIntegrity(doc)).toEqual([]);
  });

  it("warns about a currency with no sink and a loop that drives nothing", () => {
    const codes = validateDesign(
      parseDesign({ ...game, nodes: [...game.nodes!, n("lop_idle", "loop")] }),
    ).map((i) => [i.code, i.nodeId]);
    expect(codes).toContainEqual(["resource.no_sink", "res_gold"]);
    expect(codes).not.toContainEqual(["resource.no_source", "res_gold"]);
    expect(codes).toContainEqual(["loop.drives_nothing", "lop_idle"]);
  });

  it("orders the build by depends_on and skips loops", () => {
    const steps = buildPlan(indexDesign(parseDesign(game)));
    const ids = steps.map((s) => s.id);
    expect(ids).not.toContain("lop_combat");
    expect(ids.indexOf("sys_combat")).toBeLessThan(ids.indexOf("sys_loot"));
    expect(ids.indexOf("cnt_rarity")).toBeLessThan(ids.indexOf("sys_loot"));
  });

  it("renders the game sections in the brief", () => {
    const brief = renderBrief({
      project: { name: "Ashen", slug: "ashen", description: "" },
      document: parseDesign(game),
      revision: 1,
      version: null,
    });
    expect(brief).toContain("## Game vision");
    expect(brief).toContain("| Server tick | 30 Hz |  |");
    expect(brief).toContain("- **lop_combat** [lop_combat] — loop · 5–30 s");
    expect(brief).toContain("Steps: Dodge → Hit");
    expect(brief).toContain("Formula Mitigation: `D × 100 / (100 + A)`");
    expect(brief).toContain("Triggers: sys_loot on enemy defeated");
    expect(brief).toContain(
      "| res_gold [res_gold] | currency | 0 |  |  | sys_loot (on kill) | — |",
    );
    expect(brief).toContain("## Content tables");
    expect(brief).toContain("| Rare | 2–3 |");
    expect(brief).toContain("### [ms_one] Foundation — Weeks 1–3");
    expect(brief).toContain("- **Builds:** sys_combat");
    // Game systems come before technical components in game mode.
    expect(brief.indexOf("**sys_combat**")).toBeLessThan(brief.indexOf("## Economy"));
  });

  it("diffs milestones", () => {
    const before = parseDesign(game);
    const after = parseDesign({ ...game, milestones: [] });
    const diff = diffDesigns(before, after);
    expect(diff.milestones.removed.map((m) => m.id)).toEqual(["ms_one"]);
    expect(diff.isEmpty).toBe(false);
  });
});
