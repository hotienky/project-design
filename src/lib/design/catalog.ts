/**
 * Semantics of the design vocabulary. The canvas uses it for the palette,
 * containment and connection rules; integrity.ts enforces the same rules; the
 * MCP `get_design_schema` tool hands these descriptions to agents verbatim, so
 * write them for an agent that has never seen this app.
 */
import type { EdgeKind, FieldType, NodeKind } from "@/lib/design/schema";
import { ARCHITECTURE_STYLES } from "@/lib/design/schema";

export interface NodeKindMeta {
  label: string;
  /** lucide-react icon name (PascalCase) used on the canvas and palette. */
  icon: string;
  /** Resizable group node that can hold children. */
  container: boolean;
  /** Allowed parent kinds; null = may sit at the top level. */
  parents: (NodeKind | null)[];
  defaultSize: { width: number; height: number };
  description: string;
}

export const NODE_KIND_META: Record<NodeKind, NodeKindMeta> = {
  service: {
    label: "Service",
    icon: "Box",
    container: true,
    parents: [null],
    defaultSize: { width: 520, height: 360 },
    description:
      "A deployable or runnable unit: web app, API server, worker, CLI, library or mobile app. " +
      "Generate one top-level directory/package per service at data.path. Layers and modules " +
      "inside it are its internal structure.",
  },
  layer: {
    label: "Layer",
    icon: "Layers",
    container: true,
    parents: ["service"],
    defaultSize: { width: 440, height: 140 },
    description:
      "An architectural layer inside a service (e.g. presentation, application, domain, " +
      "infrastructure). Modules inside a layer may only depend on modules in the same layer or " +
      "in layers this layer has a depends_on edge to. data.rules are hard constraints.",
  },
  module: {
    label: "Module",
    icon: "Puzzle",
    container: false,
    parents: ["service", "layer"],
    defaultSize: { width: 200, height: 72 },
    description:
      "A cohesive unit of code (feature, component, package or class group) with the listed " +
      "responsibilities. data.exports is its public interface; other modules use only that.",
  },
  entity: {
    label: "Entity",
    icon: "Table2",
    container: false,
    parents: [null, "datastore", "layer", "service"],
    defaultSize: { width: 220, height: 120 },
    description:
      "A data model with typed fields. Inside a datastore it is a persisted table/collection; " +
      "inside a layer or service it is a domain/model type. Relations between entities are " +
      "relation edges, not ref fields.",
  },
  datastore: {
    label: "Datastore",
    icon: "Database",
    container: true,
    parents: [null],
    defaultSize: { width: 480, height: 300 },
    description:
      "A database, cache, object store or search index. Entities inside it are its schema. " +
      "Services/modules reach it through accesses edges.",
  },
  api: {
    label: "API",
    icon: "Plug",
    container: false,
    parents: [null],
    defaultSize: { width: 220, height: 96 },
    description:
      "An interface contract (REST, GraphQL, gRPC, tRPC, WebSocket) with operations and typed " +
      "payloads. The service/module with an exposes edge implements it; nodes with calls edges " +
      "consume it.",
  },
  integration: {
    label: "Integration",
    icon: "Cable",
    container: false,
    parents: [null],
    defaultSize: { width: 220, height: 80 },
    description:
      "A third-party system (payments, email, auth, AI, storage…). Wrap it behind an adapter in " +
      "each node that has a uses edge to it; data.env lists the credentials it needs.",
  },
  queue: {
    label: "Queue / Topic",
    icon: "Waypoints",
    container: false,
    parents: [null],
    defaultSize: { width: 220, height: 96 },
    description:
      "A message broker or event bus with named channels and typed payloads. Producers have " +
      "publishes edges, consumers have subscribes edges (edge.data.channelId picks the channel).",
  },
  actor: {
    label: "Actor",
    icon: "User",
    container: false,
    parents: [null],
    defaultSize: { width: 180, height: 72 },
    description:
      "A human role or external system that uses the project. Context only; nothing is generated.",
  },
  note: {
    label: "Note",
    icon: "StickyNote",
    container: false,
    parents: [null, "service", "layer", "datastore"],
    defaultSize: { width: 220, height: 120 },
    description: "A free-text annotation. Read it as guidance; it generates nothing by itself.",
  },
};

export const CONTAINER_KINDS = (Object.keys(NODE_KIND_META) as NodeKind[]).filter(
  (k) => NODE_KIND_META[k].container,
);

export interface EdgeKindMeta {
  label: string;
  from: NodeKind[];
  to: NodeKind[];
  description: string;
}

export const EDGE_KIND_META: Record<EdgeKind, EdgeKindMeta> = {
  depends_on: {
    label: "depends on",
    from: ["service", "layer", "module"],
    to: ["service", "layer", "module"],
    description:
      "Source code imports/uses the target. Between layers it declares an allowed dependency " +
      "direction; never generate imports that go against it.",
  },
  calls: {
    label: "calls",
    from: ["service", "module"],
    to: ["api", "service"],
    description:
      "Runtime request from source to target over data.protocol. data.operations lists the " +
      "target API operation ids used (empty = unspecified).",
  },
  exposes: {
    label: "exposes",
    from: ["service", "module"],
    to: ["api"],
    description: "Source implements and serves the target API contract.",
  },
  accesses: {
    label: "accesses",
    from: ["service", "layer", "module"],
    to: ["datastore", "entity"],
    description: "Source reads and/or writes the target store or entity (data.mode).",
  },
  publishes: {
    label: "publishes",
    from: ["service", "module"],
    to: ["queue"],
    description: "Source produces messages to the queue (channel = data.channelId).",
  },
  subscribes: {
    label: "subscribes",
    from: ["service", "module"],
    to: ["queue"],
    description: "Source consumes messages from the queue (channel = data.channelId).",
  },
  uses: {
    label: "uses",
    from: ["service", "module"],
    to: ["integration"],
    description: "Source calls the third-party integration (data.purpose says why).",
  },
  relation: {
    label: "relation",
    from: ["entity"],
    to: ["entity"],
    description:
      "Data relationship. one-to-many means one source row has many target rows; the foreign " +
      "key (data.foreignKey) lives on the target. many-to-many needs a join table.",
  },
  interacts: {
    label: "interacts",
    from: ["actor"],
    to: ["service", "api"],
    description: "An actor uses the target (data.via, e.g. 'browser', 'mobile app').",
  },
};

/** Edge kinds allowed between two node kinds, most likely first (used to preselect on connect). */
export function allowedEdgeKinds(from: NodeKind, to: NodeKind): EdgeKind[] {
  const order: EdgeKind[] = [
    "relation",
    "interacts",
    "exposes",
    "calls",
    "accesses",
    "publishes",
    "subscribes",
    "uses",
    "depends_on",
  ];
  return order.filter(
    (k) => EDGE_KIND_META[k].from.includes(from) && EDGE_KIND_META[k].to.includes(to),
  );
}

export function canContain(parent: NodeKind | null, child: NodeKind): boolean {
  return NODE_KIND_META[child].parents.includes(parent);
}

export const FIELD_TYPE_DESCRIPTIONS: Record<FieldType, string> = {
  string: "Short text (≤ 255 chars)",
  text: "Long text",
  int: "Integer",
  float: "Floating point number",
  decimal: "Exact decimal (money)",
  boolean: "true / false",
  date: "Calendar date (YYYY-MM-DD)",
  datetime: "Timestamp with time zone (ISO 8601)",
  uuid: "UUID",
  email: "Email address",
  url: "URL",
  json: "Arbitrary JSON",
  enum: "One of enumValues",
  ref: "Nested object of entity refEntityId (use list for arrays)",
};

export const ARCHITECTURE_STYLE_DESCRIPTIONS: Record<(typeof ARCHITECTURE_STYLES)[number], string> =
  {
    layered: "Horizontal layers; each layer only calls the layer(s) below it.",
    clean:
      "Clean Architecture: entities → use cases → interface adapters → frameworks; " +
      "dependencies point inward only.",
    hexagonal:
      "Ports and adapters: the domain core defines ports; adapters implement them at the edges.",
    "modular-monolith":
      "One deployable split into strongly bounded modules that talk through public interfaces.",
    microservices:
      "Independently deployable services that own their data and talk over APIs/events.",
    "event-driven": "Components communicate mainly by publishing and consuming events.",
    serverless: "Functions triggered by events/HTTP on managed infrastructure.",
    mvc: "Model-View-Controller.",
    other: "See overview.architectureNotes.",
  };

export interface PatternMeta {
  name: string;
  category: "creational" | "structural" | "behavioral" | "architectural" | "data" | "resilience";
  summary: string;
}

/** Suggestions for the patterns picker. Nodes may also name patterns not listed here. */
export const PATTERNS: PatternMeta[] = [
  { name: "Repository", category: "data", summary: "Collection-like interface over persistence." },
  { name: "Unit of Work", category: "data", summary: "Track changes and commit them atomically." },
  { name: "Data Mapper", category: "data", summary: "Map between domain objects and storage." },
  { name: "CQRS", category: "architectural", summary: "Separate read models from write models." },
  { name: "Event Sourcing", category: "data", summary: "Persist state as a sequence of events." },
  {
    name: "Transactional Outbox",
    category: "data",
    summary: "Write events in the same transaction as state, publish later.",
  },
  {
    name: "Service Layer",
    category: "architectural",
    summary: "Application operations as a thin orchestration layer.",
  },
  {
    name: "Dependency Injection",
    category: "structural",
    summary: "Pass collaborators in instead of constructing them.",
  },
  {
    name: "Ports and Adapters",
    category: "architectural",
    summary: "Core defines interfaces; edges implement them.",
  },
  {
    name: "API Gateway",
    category: "architectural",
    summary: "Single entry point that routes to services.",
  },
  {
    name: "Backend for Frontend",
    category: "architectural",
    summary: "An API shaped for one client.",
  },
  {
    name: "Saga",
    category: "resilience",
    summary: "Coordinate a multi-step transaction with compensations.",
  },
  {
    name: "Circuit Breaker",
    category: "resilience",
    summary: "Stop calling a failing dependency for a while.",
  },
  {
    name: "Retry with Backoff",
    category: "resilience",
    summary: "Retry transient failures with increasing delays.",
  },
  {
    name: "Idempotency Key",
    category: "resilience",
    summary: "Make retried requests safe to repeat.",
  },
  { name: "Factory", category: "creational", summary: "Encapsulate object creation." },
  { name: "Builder", category: "creational", summary: "Construct complex objects step by step." },
  { name: "Singleton", category: "creational", summary: "One shared instance (use sparingly)." },
  { name: "Adapter", category: "structural", summary: "Convert one interface into another." },
  { name: "Facade", category: "structural", summary: "Simple interface over a complex subsystem." },
  { name: "Decorator", category: "structural", summary: "Add behaviour by wrapping." },
  { name: "Proxy", category: "structural", summary: "Stand-in that controls access to an object." },
  {
    name: "Strategy",
    category: "behavioral",
    summary: "Interchangeable algorithms behind one interface.",
  },
  { name: "Observer", category: "behavioral", summary: "Notify subscribers of changes." },
  { name: "Command", category: "behavioral", summary: "Encapsulate a request as an object." },
  {
    name: "Mediator",
    category: "behavioral",
    summary: "Centralise communication between objects.",
  },
  {
    name: "Chain of Responsibility",
    category: "behavioral",
    summary: "Pass a request along handlers (middleware).",
  },
  { name: "State Machine", category: "behavioral", summary: "Explicit states and transitions." },
  {
    name: "Specification",
    category: "behavioral",
    summary: "Composable business rules/predicates.",
  },
  {
    name: "Pub/Sub",
    category: "architectural",
    summary: "Publishers and subscribers decoupled by topics.",
  },
];
