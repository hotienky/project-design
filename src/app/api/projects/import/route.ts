import { requirePrincipal } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { errorResponse, MAX_DESIGN_BYTES, readJson } from "@/server/http";
import { importProject } from "@/server/services/projects";

/** Body: an export envelope or a bare design document. */
export async function POST(request: Request) {
  try {
    const project = await importProject(
      getDb(),
      await readJson(request, MAX_DESIGN_BYTES),
      await requirePrincipal(),
    );
    return Response.json({ slug: project.slug }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
