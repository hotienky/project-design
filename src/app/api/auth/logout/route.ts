import { cookies } from "next/headers";

import { SESSION_COOKIE, deleteSession } from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";
import { redirectTo } from "@/server/http";

/** Ends the session. POST only, so a cross-site link can't sign anyone out. */
export async function POST() {
  const jar = await cookies();
  await deleteSession(getDb(), jar.get(SESSION_COOKIE)?.value ?? "");
  jar.delete(SESSION_COOKIE);
  return redirectTo("/");
}
