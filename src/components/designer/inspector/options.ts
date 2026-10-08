import type { NodeKind, NodeOfKind } from "@/lib/design/schema";

type Data<K extends NodeKind> = NodeOfKind<K>["data"];

/** Option lists for the inspector selects. The `satisfies` clauses fail to compile if they drift from the schema. */
export const SERVICE_TYPES = [
  "web-app",
  "api",
  "worker",
  "cli",
  "library",
  "mobile",
  "desktop",
  "function",
  "other",
] as const satisfies readonly Data<"service">["type"][];

export const DATASTORE_ENGINES = [
  "postgres",
  "mysql",
  "sqlite",
  "mongodb",
  "redis",
  "dynamodb",
  "s3",
  "elasticsearch",
  "other",
] as const satisfies readonly Data<"datastore">["engine"][];

export const API_STYLES = [
  "rest",
  "graphql",
  "grpc",
  "trpc",
  "websocket",
  "other",
] as const satisfies readonly Data<"api">["style"][];

export const API_AUTH = [
  "none",
  "session",
  "bearer",
  "api-key",
  "oauth2",
  "other",
] as const satisfies readonly Data<"api">["auth"][];

export const INTEGRATION_CATEGORIES = [
  "payments",
  "auth",
  "email",
  "storage",
  "ai",
  "analytics",
  "messaging",
  "monitoring",
  "other",
] as const satisfies readonly Data<"integration">["category"][];

export const QUEUE_TECHNOLOGIES = [
  "kafka",
  "rabbitmq",
  "sqs",
  "sns",
  "redis-streams",
  "nats",
  "pubsub",
  "other",
] as const satisfies readonly Data<"queue">["technology"][];

export const ACTOR_TYPES = ["human", "system"] as const satisfies readonly Data<"actor">["type"][];

export const NOTE_COLOR_NAMES = [
  "yellow",
  "blue",
  "green",
  "pink",
  "gray",
] as const satisfies readonly Data<"note">["color"][];
