// PROTOTYPE SUBSET — Phase 3 grows this into the full tool set (§9).
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { EDGE_KIND_META, NODE_KIND_META } from "@/lib/design/catalog";
import { designJsonSchema } from "@/lib/design/schema";
import type { Db } from "@/server/db/client";
import { getProjectBySlug, listProjects } from "@/server/services/projects";
import type { Principal } from "@/server/services/tokens";

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

export function createDesignMcpServer(deps: { db: Db; principal: Principal }): McpServer {
  const { db, principal } = deps;
  const server = new McpServer(
    { name: "project-design", version: "0.1.0" },
    {
      instructions:
        "Project designs (stack, architecture, layers, APIs, data, integrations) that you must " +
        "follow when generating code. Start with list_projects, then get_design_schema once.",
    },
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "Designs this token can read.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const rows = await listProjects(db, principal);
      return json(rows.map(({ id: _id, ...r }) => r));
    },
  );

  server.registerTool(
    "get_design_schema",
    {
      title: "Explain the design format",
      description: "Node kinds, edge kinds and the JSON Schema of a design document.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () =>
      json({
        nodeKinds: NODE_KIND_META,
        edgeKinds: EDGE_KIND_META,
        jsonSchema: designJsonSchema(),
      }),
  );

  server.registerTool(
    "get_project_design",
    {
      title: "Get a design document",
      description: "The full design document (JSON) of one project.",
      inputSchema: z.object({ project: z.string().describe("Project slug") }),
      annotations: { readOnlyHint: true },
    },
    async ({ project }) => {
      const row = await getProjectBySlug(db, project);
      if (!row || (principal.projectId && row.id !== principal.projectId)) {
        return { ...json({ error: `Unknown project "${project}"` }), isError: true };
      }
      return json({
        slug: row.slug,
        name: row.name,
        revision: row.revision,
        document: row.document,
      });
    },
  );

  return server;
}
