import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/server";

import { designJsonSchema } from "@/lib/design/schema";
import { briefOf, resolveTarget, type McpContext } from "@/server/mcp/context";
import { listProjects } from "@/server/services/projects";

const slugOf = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function registerResources(server: McpServer, ctx: McpContext) {
  server.registerResource(
    "design-schema",
    "design://schema",
    { title: "Design JSON Schema", mimeType: "application/schema+json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/schema+json",
          text: JSON.stringify(designJsonSchema(), null, 2),
        },
      ],
    }),
  );

  const list = (suffix: string, mimeType: string, label: string) => async () => ({
    resources: (await listProjects(ctx.db, ctx.principal)).map((p) => ({
      uri: `design://projects/${p.slug}/${suffix}`,
      name: `${p.name} ${label}`,
      mimeType,
    })),
  });

  server.registerResource(
    "project-brief",
    new ResourceTemplate("design://projects/{slug}/brief", {
      list: list("brief", "text/markdown", "brief"),
    }),
    { title: "Project design brief", mimeType: "text/markdown" },
    async (uri, variables) => {
      const t = await resolveTarget(ctx, { project: slugOf(variables.slug) });
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: briefOf(t) }] };
    },
  );

  server.registerResource(
    "project-document",
    new ResourceTemplate("design://projects/{slug}/document", {
      list: list("document", "application/json", "document"),
    }),
    { title: "Project design document", mimeType: "application/json" },
    async (uri, variables) => {
      const t = await resolveTarget(ctx, { project: slugOf(variables.slug) });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(t.document, null, 2),
          },
        ],
      };
    },
  );
}
