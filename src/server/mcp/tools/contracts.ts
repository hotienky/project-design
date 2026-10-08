import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { dataModel, toMermaidEr } from "@/lib/design/datamodel";
import type { DesignIndex } from "@/lib/design/graph";
import { toOpenApi } from "@/lib/design/openapi";
import type { NodeOfKind, TypeShape } from "@/lib/design/schema";
import {
  brief,
  findNode,
  guarded,
  jsonResult,
  ProjectArg,
  resolveTarget,
  textResult,
  ToolError,
  VersionArg,
  type McpContext,
} from "@/server/mcp/context";

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** Entities an API's operations mention, directly or through `ref` fields. */
function entitiesOf(index: DesignIndex, api: NodeOfKind<"api">) {
  const seen = new Set<string>();
  const visit = (id: string | null) => {
    if (!id || seen.has(id)) return;
    const entity = index.node(id);
    if (entity?.kind !== "entity") return;
    seen.add(id);
    for (const f of entity.data.fields) visit(f.refEntityId);
  };
  const shape = (s: TypeShape | null) => {
    if (!s) return;
    visit(s.entityId);
    for (const f of s.fields) visit(f.refEntityId);
  };
  for (const op of api.data.operations) {
    shape(op.request);
    shape(op.response);
  }
  return [...seen].map((id) => index.node(id)!);
}

export function registerContractTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "get_api_contract",
    {
      title: "Get an API contract",
      description:
        "The contract of one API. REST APIs are returned as OpenAPI 3.1; use format json for other styles.",
      inputSchema: z.object({
        project: ProjectArg,
        version: VersionArg,
        api: z.string().describe("API id, or its exact name."),
        format: z.enum(["openapi", "json"]).default("openapi"),
      }),
      annotations: READ_ONLY,
    },
    guarded(async (args) => {
      const t = await resolveTarget(ctx, args);
      const api = findNode(t.index, args.api, ["api"]) as NodeOfKind<"api">;
      if (args.format === "openapi") {
        const spec = toOpenApi(t.index, api.id);
        if (!spec) {
          throw new ToolError(
            `"${api.name}" is a ${api.data.style} API, which has no OpenAPI form. Use format "json".`,
          );
        }
        return jsonResult(spec);
      }
      return jsonResult({
        api,
        implementedBy: t.index
          .incoming(api.id, "exposes")
          .map((e) => ({ ...brief(t.index.node(e.source)!), operations: e.data.operations })),
        consumedBy: t.index.incoming(api.id, "calls").map((e) => ({
          ...brief(t.index.node(e.source)!),
          operations: e.data.operations,
        })),
        entities: entitiesOf(t.index, api),
      });
    }),
  );

  server.registerTool(
    "get_data_model",
    {
      title: "Get the data model",
      description:
        "Entities, fields, indexes and relations, for one datastore or all of them, as JSON or a Mermaid ER diagram.",
      inputSchema: z.object({
        project: ProjectArg,
        version: VersionArg,
        datastore: z.string().optional().describe("Datastore id or exact name; omit for all."),
        format: z.enum(["json", "mermaid"]).default("json"),
      }),
      annotations: READ_ONLY,
    },
    guarded(async (args) => {
      const t = await resolveTarget(ctx, args);
      const store = args.datastore ? findNode(t.index, args.datastore, ["datastore"]) : undefined;
      const model = dataModel(t.index, store?.id);
      return args.format === "mermaid" ? textResult(toMermaidEr(model)) : jsonResult(model);
    }),
  );
}
