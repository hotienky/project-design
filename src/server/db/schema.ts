import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import type { DesignDocument } from "@/lib/design/schema";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** One row per design. `document` is the editable draft; `revision` guards concurrent saves. */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    document: jsonb("document").$type<DesignDocument>().notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("projects_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)],
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
    document: jsonb("document").$type<DesignDocument>().notNull(),
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
    // null = every project; otherwise the token only sees this project.
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("api_tokens_project_idx").on(t.projectId)],
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
