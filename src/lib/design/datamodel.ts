/** Entities, fields, indexes and relations, as JSON or a Mermaid ER diagram. */
import type { DesignIndex } from "@/lib/design/graph";
import type { EdgeOfKind, NodeOfKind } from "@/lib/design/schema";

type Entity = NodeOfKind<"entity">;

export interface DataModelEntity {
  id: string;
  name: string;
  description: string;
  fields: Entity["data"]["fields"];
  indexes: Entity["data"]["indexes"];
}
export interface DataModelRelation {
  id: string;
  from: { id: string; name: string };
  to: { id: string; name: string };
  cardinality: EdgeOfKind<"relation">["data"]["cardinality"];
  foreignKey: string;
  required: boolean;
  onDelete: EdgeOfKind<"relation">["data"]["onDelete"];
}
export interface DataModel {
  datastores: {
    id: string;
    name: string;
    engine: string;
    version: string;
    entities: DataModelEntity[];
  }[];
  domainModels: DataModelEntity[];
  relations: DataModelRelation[];
}

const toEntity = (n: Entity): DataModelEntity => ({
  id: n.id,
  name: n.name,
  description: n.description,
  fields: n.data.fields,
  indexes: n.data.indexes,
});

export function dataModel(index: DesignIndex, datastoreId?: string): DataModel {
  const stores = index.doc.nodes.filter(
    (n): n is NodeOfKind<"datastore"> =>
      n.kind === "datastore" && (!datastoreId || n.id === datastoreId),
  );
  const datastores = stores.map((s) => ({
    id: s.id,
    name: s.name,
    engine: s.data.engine,
    version: s.data.version,
    entities: index
      .descendants(s.id)
      .filter((n): n is Entity => n.kind === "entity")
      .map(toEntity),
  }));
  const domainModels = datastoreId
    ? []
    : index.doc.nodes
        .filter((n): n is Entity => n.kind === "entity")
        .filter((n) => !index.ancestors(n.id).some((a) => a.kind === "datastore"))
        .map(toEntity);

  const visible = new Set(
    [...datastores.flatMap((d) => d.entities), ...domainModels].map((e) => e.id),
  );
  const relations: DataModelRelation[] = [];
  for (const e of index.doc.edges) {
    if (e.kind !== "relation" || !(visible.has(e.source) && visible.has(e.target))) continue;
    relations.push({
      id: e.id,
      from: { id: e.source, name: index.node(e.source)!.name },
      to: { id: e.target, name: index.node(e.target)!.name },
      cardinality: e.data.cardinality,
      foreignKey: e.data.foreignKey,
      required: e.data.required,
      onDelete: e.data.onDelete,
    });
  }
  return { datastores, domainModels, relations };
}

const safe = (name: string) => {
  const s = name.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[0-9]/.test(s) ? `E_${s}` : s || "Entity";
};

const CARDINALITY = {
  "one-to-one": { required: "||--||", optional: "||--o|" },
  "one-to-many": { required: "||--|{", optional: "||--o{" },
  "many-to-many": { required: "}o--o{", optional: "}o--o{" },
} as const;

export function toMermaidEr(model: DataModel): string {
  const entities = [...model.datastores.flatMap((d) => d.entities), ...model.domainModels];
  const fks = new Map<string, Set<string>>(); // entity id → FK field names
  for (const r of model.relations) {
    if (r.foreignKey) fks.set(r.to.id, (fks.get(r.to.id) ?? new Set()).add(r.foreignKey));
  }

  const lines = ["erDiagram"];
  for (const entity of entities) {
    lines.push(`  ${safe(entity.name)} {`);
    for (const f of entity.fields) {
      const keys = [
        f.primary && "PK",
        fks.get(entity.id)?.has(f.name) && "FK",
        f.unique && !f.primary && "UK",
      ].filter(Boolean);
      const type = f.type === "ref" ? "ref" : f.type;
      lines.push(
        `    ${type}${f.list ? "[]" : ""} ${f.name}${keys.length ? ` ${keys.join(", ")}` : ""}`,
      );
    }
    lines.push("  }");
  }
  for (const r of model.relations) {
    const token = CARDINALITY[r.cardinality][r.required ? "required" : "optional"];
    lines.push(
      `  ${safe(r.from.name)} ${token} ${safe(r.to.name)} : "${r.foreignKey || "relates"}"`,
    );
  }
  return lines.join("\n") + "\n";
}
