import { connection } from "next/server";

import { requirePrincipal } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { errorResponse } from "@/server/http";
import { getDraftRevision } from "@/server/services/projects";

/** The draft's current revision, so an open designer can notice saves made elsewhere (agents, other tabs). */
export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[slug]/revision">) {
  await connection();
  try {
    const revision = await getDraftRevision(
      getDb(),
      (await ctx.params).slug,
      await requirePrincipal(),
    );
    return Response.json({ revision });
  } catch (error) {
    return errorResponse(error);
  }
}
