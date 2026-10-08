import { connection } from "next/server";

import { getDb } from "@/server/db/client";
import { errorResponse } from "@/server/http";
import { getProject } from "@/server/services/projects";
import { getStatuses } from "@/server/services/status";

export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[slug]/status">) {
  await connection();
  try {
    const db = getDb();
    const project = await getProject(db, (await ctx.params).slug);
    const known = new Set(project.document.nodes.map((n) => n.id));
    const statuses = await getStatuses(db, project.id);
    return Response.json({
      statuses: Object.fromEntries([...statuses].filter(([id]) => known.has(id))),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
