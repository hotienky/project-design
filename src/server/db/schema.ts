import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { DesignDocumentSchema, type DesignDocument } from "@/lib/design/schema";

/**
 * A design document in a jsonb column. Writes are validated by the services (safeParseDesign);
 * reads go through the schema again so rows stored before a schema change get its new defaults
 * (e.g. an edge's `operations: []`). A row that no longer parses is returned as stored.
 */
const designDocument = customType<{ data: DesignDocument; driverData: unknown }>({
  dataType: () => "jsonb",
  toDriver: (value) => JSON.stringify(value),
  fromDriver(value) {
    const raw: unknown = typeof value === "string" ? JSON.parse(value) : value;
    const parsed = DesignDocumentSchema.safeParse(raw);
    return parsed.success ? parsed.data : (raw as DesignDocument);
  },
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** A person who signed in with GitHub. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: text("github_id").notNull().unique(),
  login: text("login").notNull(),
  name: text("name").notNull().default(""),
  avatarUrl: text("avatar_url").notNull().default(""),
  createdAt: createdAt(),
});

/** Browser sessions. The id is the SHA-256 of the cookie value, like MCP tokens. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** One row per design. `document` is the editable draft; `revision` guards concurrent saves. */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // null only for designs created before sign-in existed; the first user claims them.
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    document: designDocument("document").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("projects_owner_idx").on(t.ownerId),
    check("projects_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

/** Immutable published snapshots of a project's draft. */
export const projectVersions = pgTable(
  "project_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    label: text("label").notNull().default(""),
    notes: text("notes").notNull().default(""),
    document: designDocument("document").notNull(),
    sourceRevision: integer("source_revision").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("project_versions_project_version").on(t.projectId, t.version)],
);

/** MCP bearer tokens. Only the SHA-256 of the token is stored. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    // The user the token acts as; null only for tokens created before sign-in existed.
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    // null = every project; otherwise the token only sees this project.
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("api_tokens_project_idx").on(t.projectId),
    index("api_tokens_user_idx").on(t.userId),
  ],
);

export const COMPONENT_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];

/** Implementation progress reported by agents, keyed by design node id. */
export const componentStatus = pgTable(
  "component_status",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    status: text("status").$type<ComponentStatus>().notNull(),
    note: text("note").notNull().default(""),
    updatedByTokenId: uuid("updated_by_token_id").references(() => apiTokens.id, {
      onDelete: "set null",
    }),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.nodeId] }),
    check(
      "component_status_status",
      sql`${t.status} in ('todo', 'in_progress', 'done', 'blocked')`,
    ),
  ],
);
