import { timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { sessionCookieOptions } from "@/server/auth/current";
import {
  OAUTH_STATE_COOKIE,
  fetchGithubProfile,
  isAllowedLogin,
  safeNextPath,
} from "@/server/auth/github";
import { SESSION_COOKIE, createSession, upsertGithubUser } from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";
import { redirectTo } from "@/server/http";

function readState(raw: string | undefined): { state: string; next: string } | null {
  try {
    const value = JSON.parse(raw ?? "") as { state?: unknown; next?: unknown };
    if (typeof value.state !== "string") return null;
    return { state: value.state, next: safeNextPath(String(value.next ?? "")) };
  } catch {
    return null;
  }
}

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** GitHub redirects here with ?code&state. On success the browser gets a session cookie. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const saved = readState(jar.get(OAUTH_STATE_COOKIE)?.value);
  jar.delete(OAUTH_STATE_COOKIE);

  const code = params.get("code");
  const state = params.get("state");
  if (!saved || !code || !state || !sameState(state, saved.state)) {
    return redirectTo("/?auth_error=state");
  }

  let profile;
  try {
    profile = await fetchGithubProfile(code);
  } catch (error) {
    console.error("[auth]", error);
    return redirectTo("/?auth_error=github");
  }
  if (!isAllowedLogin(profile.login)) return redirectTo("/?auth_error=not_allowed");

  const db = getDb();
  const user = await upsertGithubUser(db, profile);
  const session = await createSession(db, user.id);
  jar.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return redirectTo(saved.next);
}
