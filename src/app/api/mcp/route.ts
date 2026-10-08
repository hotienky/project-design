import { createMcpHandler } from "@modelcontextprotocol/server";

import { getDb } from "@/server/db/client";
import { createDesignMcpServer } from "@/server/mcp/server";
import { verifyToken, type Principal } from "@/server/services/tokens";

// One handler per process. The factory builds a fresh McpServer per request
// (stateless), bound to the principal resolved from the bearer token.
const handler = createMcpHandler(
  (ctx) => {
    const principal = ctx.authInfo?.extra?.principal as Principal | undefined;
    if (!principal) throw new Error("unauthenticated MCP request reached the factory");
    return createDesignMcpServer({ db: getDb(), principal });
  },
  { onerror: (error) => console.error("[mcp]", error) },
);

function unauthorized(message: string): Response {
  return Response.json(
    { error: "invalid_token", error_description: message },
    { status: 401, headers: { "WWW-Authenticate": `Bearer error="invalid_token"` } },
  );
}

async function serve(request: Request): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return unauthorized("Missing bearer token. Create one under Settings → MCP tokens.");
  const principal = await verifyToken(getDb(), match[1]);
  if (!principal) return unauthorized("Unknown or revoked token.");
  return handler.fetch(request, {
    authInfo: {
      token: match[1],
      clientId: principal.tokenId,
      scopes: [],
      extra: { principal },
    },
  });
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
