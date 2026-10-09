import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { connection } from "next/server";

import { OAUTH_STATE_COOKIE, authorizeUrl, isLocalMode, safeNextPath } from "@/server/auth/github";
import { sessionCookieOptions } from "@/server/auth/current";
import { redirectTo } from "@/server/http";

/** Starts GitHub sign-in: remembers a CSRF state (and where to go after) in a short-lived cookie. */
export async function GET(request: Request) {
  await connection();
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  // Local mode has no sign-in: go straight in.
  if (isLocalMode()) return redirectTo(next);
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(
    OAUTH_STATE_COOKIE,
    JSON.stringify({ state, next }),
    sessionCookieOptions(new Date(Date.now() + 10 * 60 * 1000)),
  );
  return new Response(null, { status: 302, headers: { Location: authorizeUrl(state) } });
}
