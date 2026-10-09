"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { fail, type ActionResult } from "@/app/actions/types";
import type { DesignDocument } from "@/lib/design/schema";
import { requirePrincipal } from "@/server/auth/current";
import { getDb } from "@/server/db/client";
import { publishVersion, restoreVersion } from "@/server/services/versions";

const PublishInput = z.object({
  label: z.string().trim().max(120, "Label is at most 120 characters").default(""),
  notes: z.string().trim().max(5000, "Notes are at most 5000 characters").default(""),
});

/** Publishes the saved draft. The client saves pending edits first (`saveNow`) so nothing is left out. */
export async function publishVersionAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ version: number }>> {
  const parsed = PublishInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: parsed.error.issues[0]!.message } };
  }
  try {
    const { version } = await publishVersion(getDb(), slug, parsed.data, await requirePrincipal());
    refresh();
    return { ok: true, version };
  } catch (error) {
    return fail(error);
  }
}

/** Replaces the draft with a published version. Returns the new revision and document for the open store. */
export async function restoreVersionAction(
  slug: string,
  version: number,
  revision: number,
): Promise<ActionResult<{ revision: number; document: DesignDocument }>> {
  try {
    const restored = await restoreVersion(
      getDb(),
      slug,
      version,
      { revision },
      await requirePrincipal(),
    );
    refresh();
    return { ok: true, ...restored };
  } catch (error) {
    return fail(error);
  }
}
