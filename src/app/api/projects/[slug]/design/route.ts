import { connection } from "next/server";
import { z } from "zod";

import { getDb } from "@/server/db/client";
import { errorResponse, MAX_DESIGN_BYTES, readJson } from "@/server/http";
import { getProject, saveDraft } from "@/server/services/projects";

export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[slug]/design">) {
  await connection();
  try {
    const project = await getProject(getDb(), (await ctx.params).slug);
    return Response.json({
      revision: project.revision,
      document: project.document,
      updatedAt: project.updatedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

const SaveBody = z.object({ revision: z.number().int().positive(), document: z.unknown() });

export async function PUT(request: Request, ctx: RouteContext<"/api/projects/[slug]/design">) {
  try {
    const body = SaveBody.parse(await readJson(request, MAX_DESIGN_BYTES));
    const saved = await saveDraft(getDb(), (await ctx.params).slug, body);
    return Response.json(saved);
  } catch (error) {
    return errorResponse(error);
  }
}
