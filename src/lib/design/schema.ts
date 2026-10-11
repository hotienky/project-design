/**
 * The design document: the single contract shared by the canvas, the database
 * (projects.document / project_versions.document), import/export files and the
 * MCP tools. Isomorphic: no Node or React imports.
 *
 * Rules that span several objects (dangling ids, parent kinds, edge endpoint
 * kinds) live in integrity.ts, not here, so this file maps 1:1 to JSON Schema.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1;

// ── Primitives ──────────────────────────────────────────────────────────────

export const IdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, "ids are 1-64 chars of [A-Za-z0-9_-]");
const Line = z.string().trim().min(1).max(500);
const Text = (max = 10_000) => z.string().max(max).default("");
const Short = (max = 120) => z.string().trim().max(max).default("");
const Tag = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[^,\n]+$/);

export const NODE_KINDS = [
  "service",
  "layer",
  "module",
  "entity",
  "datastore",
  "api",
  "integration",
  "queue",
  "actor",
  "note",
  // Game design (overview.mode "game"); valid in any document.
  "loop",
  "system",
  "mechanic",
  "resource",
  "content",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_KINDS = [
  "depends_on",
  "calls",
  "exposes",
  "accesses",
  "publishes",
  "subscribes",
  "uses",
  "relation",
  "interacts",
  // Game design
  "drives",
  "produces",
  "consumes",
  "triggers",
  "modifies",
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const FIELD_TYPES = [
  "string",
  "text",
  "int",
  "float",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "uuid",
  "email",
  "url",
  "json",
  "enum",
  "ref",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const ARCHITECTURE_STYLES = [
  "layered",
  "clean",
  "hexagonal",
  "modular-monolith",
  "microservices",
  "event-driven",
  "serverless",
  "mvc",
  "other",
] as const;

// ── Reusable shapes ─────────────────────────────────────────────────────────

/** A typed field: entity columns, API payload fields, message payload fields. */
export const FieldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "field names are identifiers"),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(true),
  list: z.boolean().default(false),
  unique: z.boolean().default(false),
  primary: z.boolean().default(false),
  default: z.string().max(200).nullable().default(null),
  /** Only for type "enum". */
  enumValues: z.array(z.string().trim().min(1).max(64)).max(100).default([]),
  /** Only for type "ref": the entity node this field holds (nested object, not a FK). */
  refEntityId: IdSchema.nullable().default(null),
  description: Text(2000),
});
export type Field = z.output<typeof FieldSchema>;

/** A payload: an entity (optionally a list of it) or an inline list of fields. */
export const TypeShapeSchema = z.object({
  entityId: IdSchema.nullable().default(null),
  list: z.boolean().default(false),
  fields: z.array(FieldSchema).max(200).default([]),
  description: Text(2000),
});
export type TypeShape = z.output<typeof TypeShapeSchema>;

export const EnvVarSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/, "env var names are UPPER_SNAKE_CASE")
    .max(100),
  description: Text(1000),
  required: z.boolean().default(true),
  secret: z.boolean().default(false),
  example: Short(200),
});
export type EnvVar = z.output<typeof EnvVarSchema>;

export const PatternUseSchema = z.object({
  /** A design pattern name, ideally one from catalog.ts PATTERNS (free text allowed). */
  name: z.string().trim().min(1).max(80),
  notes: Text(2000),
});

/** A named value: a tuning parameter, a design parameter or a quality target. */
export const ParameterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  value: Short(200),
  unit: Short(40),
  notes: Text(1000),
});
export type Parameter = z.output<typeof ParameterSchema>;

/** A rule written as a formula, e.g. "D_final = D_raw × 100 / (100 + A)". */
export const FormulaSchema = z.object({
  name: z.string().trim().min(1).max(80),
  expression: z.string().trim().min(1).max(500),
  notes: Text(1000),
});
export type Formula = z.output<typeof FormulaSchema>;

export const GAME_PRIORITIES = ["mvp", "launch", "later"] as const;

// ── Nodes ───────────────────────────────────────────────────────────────────

const PositionSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
const SizeSchema = z.object({
  width: z.number().positive().max(20_000),
  height: z.number().positive().max(20_000),
});

const NodeBase = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(120),
  /** Markdown. For notes this is the note text. */
  description: Text(),
  /** Container node (see catalog PARENT_RULES); null = top level. */
  parentId: IdSchema.nullable().default(null),
  /** Canvas position, relative to the parent when parentId is set (React Flow convention). */
  position: PositionSchema.prefault({ x: 0, y: 0 }),
  /** Set for resizable containers (service, layer, datastore); null = auto. */
  size: SizeSchema.nullable().default(null),
  tags: z.array(Tag).max(30).default([]),
  patterns: z.array(PatternUseSchema).max(30).default([]),
});

export const ServiceDataSchema = z.object({
  type: z
    .enum(["web-app", "api", "worker", "cli", "library", "mobile", "desktop", "function", "other"])
    .default("api"),
  language: Short(60),
  framework: Short(60),
  runtime: Short(60),
  /** Directory in the generated repository, e.g. "apps/web". */
  path: Short(200),
  port: z.number().int().min(1).max(65_535).nullable().default(null),
  responsibilities: z.array(Line).max(50).default([]),
  env: z.array(EnvVarSchema).max(100).default([]),
});

export const LayerDataSchema = z.object({
  path: Short(200),
  responsibilities: z.array(Line).max(50).default([]),
  /** Free-text rules, e.g. "No framework imports". Allowed dependencies are depends_on edges. */
  rules: z.array(Line).max(50).default([]),
});

export const ModuleDataSchema = z.object({
  path: Short(200),
  responsibilities: z.array(Line).max(50).default([]),
  /** Public interface, one signature or symbol per line. */
  exports: z.array(Line).max(100).default([]),
});

export const EntityDataSchema = z.object({
  fields: z.array(FieldSchema).max(300).default([]),
  indexes: z
    .array(
      z.object({
        fields: z.array(z.string().trim().min(1).max(64)).min(1).max(16),
        unique: z.boolean().default(false),
      }),
    )
    .max(50)
    .default([]),
});

export const DatastoreDataSchema = z.object({
  engine: z
    .enum([
      "postgres",
      "mysql",
      "sqlite",
      "mongodb",
      "redis",
      "dynamodb",
      "s3",
      "elasticsearch",
      "other",
    ])
    .default("postgres"),
  version: Short(40),
  purpose: Text(2000),
});

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export const OperationSchema = z.object({
  id: IdSchema,
  /** Identifier-like name: operationId for REST, field for GraphQL, method for gRPC/tRPC. */
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z_][A-Za-z0-9_.]*$/),
  summary: Text(2000),
  /** REST only. */
  method: z.enum(HTTP_METHODS).nullable().default(null),
  /** REST only, relative to the API basePath, with {param} placeholders. */
  path: z.string().trim().max(300).nullable().default(null),
  auth: z.enum(["inherit", "none", "required"]).default("inherit"),
  request: TypeShapeSchema.nullable().default(null),
  response: TypeShapeSchema.nullable().default(null),
  errors: z
    .array(z.object({ status: z.number().int().min(100).max(599), description: Text(500) }))
    .max(20)
    .default([]),
});
export type Operation = z.output<typeof OperationSchema>;

export const ApiDataSchema = z.object({
  style: z.enum(["rest", "graphql", "grpc", "trpc", "websocket", "other"]).default("rest"),
  basePath: Short(200),
  version: Short(40),
  auth: z.enum(["none", "session", "bearer", "api-key", "oauth2", "other"]).default("none"),
  operations: z.array(OperationSchema).max(300).default([]),
});

export const IntegrationDataSchema = z.object({
  provider: Short(80),
  category: z
    .enum([
      "payments",
      "auth",
      "email",
      "storage",
      "ai",
      "analytics",
      "messaging",
      "monitoring",
      "other",
    ])
    .default("other"),
  purpose: Text(2000),
  docsUrl: Short(500),
  sdk: Short(120),
  env: z.array(EnvVarSchema).max(50).default([]),
});

export const ChannelSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(200),
  description: Text(2000),
  payload: TypeShapeSchema.prefault({}),
});

export const QueueDataSchema = z.object({
  technology: z
    .enum(["kafka", "rabbitmq", "sqs", "sns", "redis-streams", "nats", "pubsub", "other"])
    .default("other"),
  channels: z.array(ChannelSchema).max(200).default([]),
});

export const ActorDataSchema = z.object({
  type: z.enum(["human", "system"]).default("human"),
  goals: z.array(Line).max(50).default([]),
});

export const NoteDataSchema = z.object({
  color: z.enum(["yellow", "blue", "green", "pink", "gray"]).default("yellow"),
});

export const GAME_SYSTEM_CATEGORIES = [
  "core",
  "combat",
  "character",
  "abilities",
  "items",
  "progression",
  "ai",
  "world",
  "multiplayer",
  "economy",
  "ui",
  "audio-visual",
  "meta",
  "tech",
  "other",
] as const;

export const LoopDataSchema = z.object({
  /** How long one turn of the loop takes, e.g. "5–30 seconds". */
  duration: Short(80),
  motivation: Text(2000),
  /** The beats of the loop in order. */
  steps: z.array(Line).max(30).default([]),
});

const DesignRules = {
  rules: z.array(Line).max(50).default([]),
  parameters: z.array(ParameterSchema).max(100).default([]),
  formulas: z.array(FormulaSchema).max(30).default([]),
  priority: z.enum(GAME_PRIORITIES).default("mvp"),
};

export const SystemDataSchema = z.object({
  category: z.enum(GAME_SYSTEM_CATEGORIES).default("core"),
  purpose: Text(2000),
  /** Who owns the system's state in multiplayer. */
  authority: z
    .enum(["unspecified", "server", "client", "backend", "shared"])
    .default("unspecified"),
  ...DesignRules,
});

export const MechanicDataSchema = z.object({
  /** What starts it, e.g. "Space / B button", "enemy killed". */
  trigger: Short(200),
  /** States or phases in order, e.g. Startup → Active → Recovery. */
  states: z.array(Line).max(30).default([]),
  ...DesignRules,
});

export const RESOURCE_TYPES = [
  "stat",
  "attribute",
  "currency",
  "material",
  "item",
  "experience",
  "other",
] as const;

export const ResourceDataSchema = z.object({
  type: z.enum(RESOURCE_TYPES).default("stat"),
  initial: Short(60),
  min: Short(60),
  max: Short(60),
  /** Passive regeneration or decay, e.g. "20/s after 1 s delay". */
  regen: Short(200),
});

export const CONTENT_TYPES = [
  "character",
  "class",
  "enemy",
  "boss",
  "item",
  "ability",
  "level",
  "quest",
  "table",
  "other",
] as const;

export const ContentDataSchema = z.object({
  type: z.enum(CONTENT_TYPES).default("table"),
  /** A table of content definitions: column headers and rows of cells. */
  columns: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  rows: z
    .array(z.array(z.string().max(500)).max(12))
    .max(200)
    .default([]),
  priority: z.enum(GAME_PRIORITIES).default("mvp"),
});

// Every data schema below has a default for every field, so `{}` is a valid input.
const node = <K extends NodeKind, D extends z.ZodObject>(kind: K, data: D) =>
  NodeBase.extend({ kind: z.literal(kind), data: data.prefault({} as z.input<D>) });

export const ServiceNodeSchema = node("service", ServiceDataSchema);
export const LayerNodeSchema = node("layer", LayerDataSchema);
export const ModuleNodeSchema = node("module", ModuleDataSchema);
export const EntityNodeSchema = node("entity", EntityDataSchema);
export const DatastoreNodeSchema = node("datastore", DatastoreDataSchema);
export const ApiNodeSchema = node("api", ApiDataSchema);
export const IntegrationNodeSchema = node("integration", IntegrationDataSchema);
export const QueueNodeSchema = node("queue", QueueDataSchema);
export const ActorNodeSchema = node("actor", ActorDataSchema);
export const NoteNodeSchema = node("note", NoteDataSchema);
export const LoopNodeSchema = node("loop", LoopDataSchema);
export const SystemNodeSchema = node("system", SystemDataSchema);
export const MechanicNodeSchema = node("mechanic", MechanicDataSchema);
export const ResourceNodeSchema = node("resource", ResourceDataSchema);
export const ContentNodeSchema = node("content", ContentDataSchema);

export const NodeSchema = z.discriminatedUnion("kind", [
  ServiceNodeSchema,
  LayerNodeSchema,
  ModuleNodeSchema,
  EntityNodeSchema,
  DatastoreNodeSchema,
  ApiNodeSchema,
  IntegrationNodeSchema,
  QueueNodeSchema,
  ActorNodeSchema,
  NoteNodeSchema,
  LoopNodeSchema,
  SystemNodeSchema,
  MechanicNodeSchema,
  ResourceNodeSchema,
  ContentNodeSchema,
]);
export type DesignNode = z.output<typeof NodeSchema>;
export type NodeOfKind<K extends NodeKind> = Extract<DesignNode, { kind: K }>;

// ── Edges ───────────────────────────────────────────────────────────────────

const EdgeBase = z.object({
  id: IdSchema,
  source: IdSchema,
  target: IdSchema,
  label: Short(120),
  description: Text(4000),
});

const edge = <K extends EdgeKind, D extends z.ZodObject>(kind: K, data: D) =>
  EdgeBase.extend({ kind: z.literal(kind), data: data.prefault({} as z.input<D>) });

export const EdgeSchema = z.discriminatedUnion("kind", [
  edge("depends_on", z.object({})),
  edge(
    "calls",
    z.object({
      protocol: z
        .enum(["http", "grpc", "graphql", "websocket", "in-process", "other"])
        .default("http"),
      /** Operation ids on the target API this caller uses; empty = unspecified. */
      operations: z.array(IdSchema).max(300).default([]),
    }),
  ),
  edge(
    "exposes",
    z.object({
      /** Operation ids on the target API this source implements; empty = the whole API. */
      operations: z.array(IdSchema).max(300).default([]),
    }),
  ),
  edge(
    "accesses",
    z.object({ mode: z.enum(["read", "write", "read-write"]).default("read-write") }),
  ),
  edge("publishes", z.object({ channelId: IdSchema.nullable().default(null) })),
  edge("subscribes", z.object({ channelId: IdSchema.nullable().default(null) })),
  edge("uses", z.object({ purpose: Text(1000) })),
  edge(
    "relation",
    z.object({
      cardinality: z.enum(["one-to-one", "one-to-many", "many-to-many"]).default("one-to-many"),
      /** FK field on the "many" side, if it exists. */
      foreignKey: Short(64),
      required: z.boolean().default(false),
      onDelete: z.enum(["no-action", "cascade", "restrict", "set-null"]).default("no-action"),
    }),
  ),
  edge("interacts", z.object({ via: Short(120) })),
  edge("drives", z.object({})),
  edge("produces", z.object({ rate: Short(200) })),
  edge("consumes", z.object({ amount: Short(200) })),
  edge("triggers", z.object({ event: Short(200) })),
  edge("modifies", z.object({ effect: Short(200) })),
]);
export type DesignEdge = z.output<typeof EdgeSchema>;
export type EdgeOfKind<K extends EdgeKind> = Extract<DesignEdge, { kind: K }>;

// ── Project-level sections ──────────────────────────────────────────────────

export const STACK_CATEGORIES = [
  "language",
  "framework",
  "ui",
  "database",
  "orm",
  "cache",
  "messaging",
  "auth",
  "testing",
  "build",
  "ci",
  "hosting",
  "observability",
  "library",
  "other",
] as const;

export const StackItemSchema = z.object({
  id: IdSchema,
  category: z.enum(STACK_CATEGORIES),
  name: z.string().trim().min(1).max(80),
  version: Short(40),
  notes: Text(2000),
  /** Node ids this choice applies to (and their descendants); empty = whole project. */
  scope: z.array(IdSchema).max(100).default([]),
});
export type StackItem = z.output<typeof StackItemSchema>;

export const CONVENTION_CATEGORIES = [
  "structure",
  "naming",
  "code-style",
  "testing",
  "error-handling",
  "security",
  "performance",
  "documentation",
  "git",
  "other",
] as const;

export const ConventionSchema = z.object({
  id: IdSchema,
  category: z.enum(CONVENTION_CATEGORIES),
  level: z.enum(["must", "should", "may"]).default("should"),
  rule: z.string().trim().min(1).max(2000),
  scope: z.array(IdSchema).max(100).default([]),
});
export type Convention = z.output<typeof ConventionSchema>;

export const DecisionSchema = z.object({
  id: IdSchema,
  title: z.string().trim().min(1).max(200),
  status: z.enum(["proposed", "accepted", "deprecated", "superseded"]).default("accepted"),
  context: Text(),
  decision: Text(),
  consequences: Text(),
  date: z
    .string()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/)
    .default(""),
});
export type Decision = z.output<typeof DecisionSchema>;

export const MilestoneSchema = z.object({
  id: IdSchema,
  title: z.string().trim().min(1).max(200),
  /** Free text, e.g. "Weeks 1–3" or "Q1 2027". */
  timeframe: Short(80),
  deliverables: z.array(Line).max(50).default([]),
  exitCriteria: Text(2000),
  /** Node ids built in this milestone; empty = not tied to components. */
  scope: z.array(IdSchema).max(100).default([]),
});
export type Milestone = z.output<typeof MilestoneSchema>;

export const DESIGN_MODES = ["software", "game"] as const;
export type DesignMode = (typeof DESIGN_MODES)[number];

export const GameOverviewSchema = z.object({
  genre: Short(120),
  engine: Short(80),
  platforms: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  /** Design pillars: the principles every system must serve. */
  pillars: z.array(Line).max(20).default([]),
  /** Design parameters: players, camera, session length, monetization… */
  parameters: z.array(ParameterSchema).max(50).default([]),
  /** Reference games and what to take from each. */
  references: z
    .array(z.object({ name: z.string().trim().min(1).max(80), takeaway: Text(500) }))
    .max(20)
    .default([]),
  /** Performance and quality targets, e.g. 60 FPS, 30 Hz server tick. */
  targets: z.array(ParameterSchema).max(30).default([]),
});

export const OverviewSchema = z.object({
  /** "game" switches the designer to game systems (loops, systems, mechanics, resources). */
  mode: z.enum(DESIGN_MODES).default("software"),
  summary: Text(),
  goals: z.array(Line).max(50).default([]),
  nonGoals: z.array(Line).max(50).default([]),
  architectureStyle: z.enum(ARCHITECTURE_STYLES).default("layered"),
  architectureNotes: Text(),
  repository: z
    .object({
      layout: z.enum(["single-package", "monorepo"]).default("single-package"),
      packageManager: Short(40),
      notes: Text(4000),
    })
    .prefault({}),
  game: GameOverviewSchema.prefault({}),
});

// ── Document ────────────────────────────────────────────────────────────────

export const DesignDocumentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  overview: OverviewSchema.prefault({}),
  stack: z.array(StackItemSchema).max(200).default([]),
  conventions: z.array(ConventionSchema).max(300).default([]),
  decisions: z.array(DecisionSchema).max(200).default([]),
  milestones: z.array(MilestoneSchema).max(100).default([]),
  nodes: z.array(NodeSchema).max(2_000).default([]),
  edges: z.array(EdgeSchema).max(5_000).default([]),
});
export type DesignDocument = z.output<typeof DesignDocumentSchema>;
export type DesignDocumentInput = z.input<typeof DesignDocumentSchema>;

export function emptyDesign(): DesignDocument {
  return DesignDocumentSchema.parse({ schemaVersion: SCHEMA_VERSION });
}

/** JSON Schema (2020-12) of the *input* form: everything with a default is optional. */
export function designJsonSchema() {
  return z.toJSONSchema(DesignDocumentSchema, { io: "input", target: "draft-2020-12" });
}
