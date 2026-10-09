"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { teamTasksDesign } from "@/lib/design/examples/team-tasks";
import { fail, type ActionResult } from "@/app/actions/types";
import { requirePrincipal } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import {
  createProject,
  deleteProject,
  duplicateProject,
  updateProjectMeta,
} from "@/server/services/projects";

const Name = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Name is at most 120 characters");
const Description = z.string().trim().max(2000);

function invalid(error: z.ZodError): { ok: false; error: { code: string; message: string } } {
  return {
    ok: false,
    error: { code: "VALIDATION", message: error.issues[0]?.message ?? "Invalid input" },
  };
}

const CreateInput = z.object({
  name: Name,
  description: Description.default(""),
  template: z.enum(["blank", "example"]).default("blank"),
});

/** Creates a project and navigates to it. Only returns when something went wrong. */
export async function createProjectAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  let slug: string;
  try {
    const { userId } = await requirePrincipal();
    const project = await createProject(getDb(), {
      ownerId: userId,
      name: parsed.data.name,
      description: parsed.data.description,
      document: parsed.data.template === "example" ? teamTasksDesign : undefined,
    });
    slug = project.slug;
  } catch (error) {
    return fail(error);
  }
  redirect(`/projects/${slug}`);
}

export async function renameProjectAction(slug: string, input: unknown): Promise<ActionResult> {
  const parsed = z.object({ name: Name }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await updateProjectMeta(getDb(), slug, { name: parsed.data.name }, await requirePrincipal());
  } catch (error) {
    return fail(error);
  }
  refresh();
  return { ok: true };
}

export async function duplicateProjectAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = z.object({ name: Name }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const copy = await duplicateProject(
      getDb(),
      slug,
      { name: parsed.data.name },
      await requirePrincipal(),
    );
    refresh();
    return { ok: true, slug: copy.slug };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteProjectAction(slug: string): Promise<ActionResult> {
  try {
    await deleteProject(getDb(), slug, await requirePrincipal());
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      refresh();
      return { ok: true };
    }
    return fail(error);
  }
  refresh();
  return { ok: true };
}
