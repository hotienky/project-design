import { connection } from "next/server";

import { getDb } from "@/server/db/client";
import { errorResponse, parseVersionRef } from "@/server/http";
import { exportProject } from "@/server/services/projects";

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[slug]/export">) {
  await connection();
  try {
    const { slug } = await ctx.params;
    const raw = new URL(request.url).searchParams.get("version");
    const ref = parseVersionRef(raw);
    const envelope = await exportProject(getDb(), slug, ref);
    return new Response(JSON.stringify(envelope, null, 2) + "\n", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-${ref}.design.json"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
