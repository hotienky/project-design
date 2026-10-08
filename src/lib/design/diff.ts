/** Semantic diff between two designs, matched by id. Layout (position, size) is ignored. */
import type { DesignIndex } from "@/lib/design/graph";
import type {
  Convention,
  Decision,
  DesignDocument,
  DesignEdge,
  DesignNode,
  StackItem,
} from "@/lib/design/schema";

export interface ItemChange<T> {
  before: T;
  after: T;
  fields: string[];
}
export interface Section<T> {
  added: T[];
  removed: T[];
  changed: ItemChange<T>[];
}
export interface DesignDiff {
  overview: string[]; // changed overview keys
  stack: Section<StackItem>;
  conventions: Section<Convention>;
  decisions: Section<Decision>;
  nodes: Section<DesignNode>;
  edges: Section<DesignEdge>;
  isEmpty: boolean;
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

type Item = { id: string } & Record<string, unknown>;

/** Changed top-level keys; `data` is expanded to dotted paths. */
function changedFields(before: Item, after: Item, ignore: string[]): string[] {
  const fields: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) {
    if (key === "id" || ignore.includes(key)) continue;
    if (key === "data") {
      const b = (before.data ?? {}) as Record<string, unknown>;
      const a = (after.data ?? {}) as Record<string, unknown>;
      for (const sub of [...new Set([...Object.keys(b), ...Object.keys(a)])].sort()) {
        if (stable(b[sub]) !== stable(a[sub])) fields.push(`data.${sub}`);
      }
    } else if (stable(before[key]) !== stable(after[key])) {
      fields.push(key);
    }
  }
  return fields;
}

function diffSection<T extends { id: string }>(
  before: T[],
  after: T[],
  ignore: string[] = [],
): Section<T> {
  const beforeById = new Map(before.map((i) => [i.id, i]));
  const afterIds = new Set(after.map((i) => i.id));
  const section: Section<T> = {
    added: after.filter((i) => !beforeById.has(i.id)),
    removed: before.filter((i) => !afterIds.has(i.id)),
    changed: [],
  };
  for (const item of after) {
    const old = beforeById.get(item.id);
    if (!old) continue;
    const fields = changedFields(old as unknown as Item, item as unknown as Item, ignore);
    if (fields.length > 0) section.changed.push({ before: old, after: item, fields });
  }
  return section;
}

const sectionEmpty = (s: Section<unknown>) =>
  s.added.length + s.removed.length + s.changed.length === 0;

export function diffDesigns(before: DesignDocument, after: DesignDocument): DesignDiff {
  const overview = changedFields({ id: "", ...before.overview }, { id: "", ...after.overview }, []);
  const diff: DesignDiff = {
    overview,
    stack: diffSection(before.stack, after.stack),
    conventions: diffSection(before.conventions, after.conventions),
    decisions: diffSection(before.decisions, after.decisions),
    nodes: diffSection(before.nodes, after.nodes, ["position", "size"]),
    edges: diffSection(before.edges, after.edges),
    isEmpty: false,
  };
  diff.isEmpty =
    overview.length === 0 &&
    [diff.stack, diff.conventions, diff.decisions, diff.nodes, diff.edges].every(sectionEmpty);
  return diff;
}

export function renderDiffMarkdown(
  diff: DesignDiff,
  after: DesignIndex,
  before: DesignIndex,
): string {
  if (diff.isEmpty) return "No changes.\n";
  const lines: string[] = ["# Design changes", ""];
  const block = (title: string, body: string[]) => {
    if (body.length > 0) lines.push(`## ${title}`, "", ...body, "");
  };
  const render = <T extends { id: string }>(
    section: Section<T>,
    describe: (item: T, side: "before" | "after", withParent: boolean) => string,
  ) => [
    ...section.added.map((i) => `+ Added ${describe(i, "after", true)}`),
    ...section.changed.map(
      (c) => `~ Changed ${describe(c.after, "after", false)}: ${c.fields.join(", ")}`,
    ),
    ...section.removed.map((i) => `- Removed ${describe(i, "before", true)}`),
  ];

  block("Overview", diff.overview.length > 0 ? [`~ Changed: ${diff.overview.join(", ")}`] : []);
  block(
    "Stack",
    render(
      diff.stack,
      (s) => `**${s.name}**${s.version ? ` ${s.version}` : ""} (${s.category}) [${s.id}]`,
    ),
  );
  block(
    "Conventions",
    render(diff.conventions, (c) => `${c.level.toUpperCase()} convention [${c.id}]: ${c.rule}`),
  );
  block(
    "Decisions",
    render(diff.decisions, (d) => `decision **${d.title}** (${d.status}) [${d.id}]`),
  );
  block(
    "Components",
    render(diff.nodes, (n, side, withParent) => {
      const index = side === "after" ? after : before;
      const parent = withParent && n.parentId ? index.path(n.parentId) : "";
      return `${n.kind} **${n.name}** [${n.id}]${parent ? ` in ${parent}` : ""}`;
    }),
  );
  block(
    "Connections",
    render(diff.edges, (e, side) => {
      const index = side === "after" ? after : before;
      const name = (id: string) => index.node(id)?.name ?? id;
      return `${e.kind} **${name(e.source)}** → **${name(e.target)}** [${e.id}]`;
    }),
  );
  return lines.join("\n").trimEnd() + "\n";
}
