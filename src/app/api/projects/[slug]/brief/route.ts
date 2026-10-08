import { connection } from "next/server";

import { renderBrief } from "@/lib/design/brief";
import { getDb } from "@/server/db/client";
import { errorResponse, parseVersionRef } from "@/server/http";
import { getStatuses } from "@/server/services/status";
import { resolveDocument } from "@/server/services/versions";

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[slug]/brief">) {
  await connection();
  try {
    const { slug } = await ctx.params;
    const ref = parseVersionRef(new URL(request.url).searchParams.get("version"));
    const db = getDb();
    const resolved = await resolveDocument(db, slug, ref);
    const statuses = await getStatuses(db, resolved.project.id);
    const brief = renderBrief({
      project: resolved.project,
      document: resolved.document,
      revision: resolved.revision,
      version: resolved.version,
      statuses: new Map([...statuses].map(([id, s]) => [id, s.status])),
    });
    return new Response(brief, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-${ref}.md"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
