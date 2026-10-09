import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { SESSION_COOKIE, getSessionUser, type UserRow } from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import type { Principal } from "@/server/services/tokens";

/** The signed-in user for this request, or null. Read once per request. */
export const getCurrentUser = cache(async (): Promise<UserRow | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  // The lookup compares expiry with the clock, so it must run at request time, not in a prerender.
  await connection();
  return getSessionUser(getDb(), token);
});

const principalOf = (user: UserRow): Principal => ({
  userId: user.id,
  tokenId: null,
  projectId: null,
});

/** For pages: the signed-in principal, or a redirect to the landing page. */
export async function requirePagePrincipal(): Promise<Principal> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return principalOf(user);
}

/** For server actions and route handlers: the signed-in principal, or UNAUTHORIZED. */
export async function requirePrincipal(): Promise<Principal> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED", "Sign in to continue");
  return principalOf(user);
}

export const sessionCookieOptions = (expires: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env().APP_URL.startsWith("https://"),
  path: "/",
  expires,
});
