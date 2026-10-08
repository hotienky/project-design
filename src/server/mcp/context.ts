/** Shared plumbing for MCP tools, prompts and resources: project resolution and result helpers. */
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";

import { renderBrief } from "@/lib/design/brief";
import { indexDesign, type DesignIndex } from "@/lib/design/graph";
import type { DesignDocument } from "@/lib/design/schema";
import type { ComponentStatus } from "@/lib/design/status";
import type { Db } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { listProjects } from "@/server/services/projects";
import { getStatuses, type StatusInfo } from "@/server/services/status";
import type { Principal } from "@/server/services/tokens";
import { resolveDocument, type VersionRef } from "@/server/services/versions";

export interface McpContext {
  db: Db;
  principal: Principal;
}

export const ProjectArg = z
  .string()
  .optional()
  .describe(
    "Project slug. Optional when the token is scoped to one project or only one project exists.",
  );

export const VersionArg = z
  .union([z.literal("draft"), z.literal("latest"), z.number().int().positive()])
  .default("draft")
  .describe('"draft" (current, default), "latest" (newest published version) or a version number.');

/** A failure the agent can act on; reported as an `isError` tool result. */
export class ToolError extends Error {}

export const textResult = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
});
export const jsonResult = (value: unknown): CallToolResult =>
  textResult(JSON.stringify(value, null, 2));
export const toolError = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

/** Wraps a handler so domain failures become tool errors instead of protocol errors. */
export function guarded<A>(handler: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await handler(args);
    } catch (error) {
      if (error instanceof ToolError || error instanceof AppError) return toolError(error.message);
      throw error;
    }
  };
}

export interface Target {
  project: { id: string; slug: string; name: string; description: string };
  document: DesignDocument;
  index: DesignIndex;
  revision: number;
  version: { number: number; label: string } | null;
  statuses: Map<string, ComponentStatus>;
  statusInfo: Map<string, StatusInfo>;
}

/** Slug of the project a call refers to: the argument, the token's scope, or the only one visible. */
export async function resolveSlug(ctx: McpContext, project?: string): Promise<string> {
  const visible = (await listProjects(ctx.db, ctx.principal)).map((p) => p.slug);
  if (project !== undefined) {
    if (visible.includes(project)) return project;
    throw new ToolError(`Unknown project "${project}". Available: ${visible.join(", ") || "none"}`);
  }
  if (visible.length === 1) return visible[0]!;
  if (visible.length === 0) throw new ToolError("No projects are available to this token.");
  throw new ToolError(`Several projects are available: ${visible.join(", ")}. Pass project.`);
}

export async function resolveTarget(
  ctx: McpContext,
  args: { project?: string; version?: VersionRef },
): Promise<Target> {
  const slug = await resolveSlug(ctx, args.project);
  const resolved = await resolveDocument(ctx.db, slug, args.version ?? "draft", ctx.principal);
  const statusInfo = await getStatuses(ctx.db, resolved.project.id);
  return {
    ...resolved,
    index: indexDesign(resolved.document),
    statusInfo,
    statuses: new Map([...statusInfo].map(([id, s]) => [id, s.status])),
  };
}

/** The same markdown for the get_project_brief tool, the brief resource and the REST route. */
export const briefOf = (t: Target): string =>
  renderBrief({
    project: t.project,
    document: t.document,
    revision: t.revision,
    version: t.version,
    statuses: t.statuses,
  });

/** Finds a node by id or exact name; ambiguous or unknown references become tool errors. */
export function findNode(index: DesignIndex, ref: string, kinds?: readonly string[]) {
  const byId = index.node(ref);
  const candidates = byId ? [byId] : index.findByName(ref);
  const matches = kinds ? candidates.filter((n) => kinds.includes(n.kind)) : candidates;
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) {
    throw new ToolError(
      `No ${kinds ? kinds.join("/") : "component"} with id or name "${ref}". Use list_components.`,
    );
  }
  throw new ToolError(
    `"${ref}" matches several components; pass an id: ` +
      matches.map((n) => `${n.name} [${n.id}] (${n.kind})`).join(", "),
  );
}

export const brief = (n: { id: string; name: string; kind: string }) => ({
  id: n.id,
  name: n.name,
  kind: n.kind,
});
