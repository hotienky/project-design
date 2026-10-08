"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/app/actions/types";
import { getDb } from "@/server/db/client";
import { getProject } from "@/server/services/projects";
import { createToken, revokeToken } from "@/server/services/tokens";

const CreateInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is at most 80 characters"),
  /** Project slug, or null for a token that can read every project. */
  projectSlug: z.string().nullable().default(null),
});

/** The plaintext token is returned here once and never stored. */
export async function createTokenAction(input: unknown): Promise<ActionResult<{ token: string }>> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: parsed.error.issues[0]!.message } };
  }
  try {
    const db = getDb();
    const project = parsed.data.projectSlug ? await getProject(db, parsed.data.projectSlug) : null;
    const { token } = await createToken(db, { name: parsed.data.name, projectId: project?.id });
    refresh();
    return { ok: true, token };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeTokenAction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid token id" } };
  }
  await revokeToken(getDb(), id);
  refresh();
  return { ok: true };
}
