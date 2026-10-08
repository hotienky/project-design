import { McpServer } from "@modelcontextprotocol/server";

import type { Db } from "@/server/db/client";
import type { McpContext } from "@/server/mcp/context";
import { registerPrompts } from "@/server/mcp/prompts";
import { registerResources } from "@/server/mcp/resources";
import { registerContractTools } from "@/server/mcp/tools/contracts";
import { registerPlanTools } from "@/server/mcp/tools/plan";
import { registerReadTools } from "@/server/mcp/tools/read";
import { registerSchemaTools } from "@/server/mcp/tools/schema";
import type { Principal } from "@/server/services/tokens";

export function createDesignMcpServer(deps: { db: Db; principal: Principal }): McpServer {
  const ctx: McpContext = { db: deps.db, principal: deps.principal };
  const server = new McpServer(
    { name: "project-design", version: "0.1.0" },
    {
      instructions:
        "Project designs (stack, architecture, layers, APIs, data, integrations) that you must " +
        "follow when generating code. Start with list_projects, then get_design_schema once and " +
        "get_project_brief for the design. The implement_design prompt describes the full " +
        "workflow; report progress with set_component_status.",
    },
  );
  registerSchemaTools(server);
  registerReadTools(server, ctx);
  registerContractTools(server, ctx);
  registerPlanTools(server, ctx);
  registerPrompts(server, ctx);
  registerResources(server, ctx);
  return server;
}
