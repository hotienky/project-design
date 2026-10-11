import {
  CONTENT_TYPES,
  GAME_PRIORITIES,
  GAME_SYSTEM_CATEGORIES,
  RESOURCE_TYPES,
  type NodeKind,
  type NodeOfKind,
} from "@/lib/design/schema";

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

export const GAME_SYSTEM_CATEGORY_OPTIONS =
  GAME_SYSTEM_CATEGORIES satisfies readonly Data<"system">["category"][];

export const SYSTEM_AUTHORITIES = [
  "unspecified",
  "server",
  "client",
  "backend",
  "shared",
] as const satisfies readonly Data<"system">["authority"][];

export const GAME_PRIORITY_OPTIONS =
  GAME_PRIORITIES satisfies readonly Data<"system">["priority"][];

export const RESOURCE_TYPE_OPTIONS = RESOURCE_TYPES satisfies readonly Data<"resource">["type"][];

export const CONTENT_TYPE_OPTIONS = CONTENT_TYPES satisfies readonly Data<"content">["type"][];
