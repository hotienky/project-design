import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { SESSION_COOKIE } from "@/server/auth/sessions";
import { STORAGE_STATE, e2eUser, newSession } from "./helpers";

/**
 * Signs the browser in without GitHub: creates the e2e user and a session in the test database
 * and saves the session cookie as Playwright storage state.
 */
export default async function globalSetup() {
  const user = await e2eUser();
  const session = await newSession(user.id);
  await mkdir(dirname(STORAGE_STATE), { recursive: true });
  await writeFile(
    STORAGE_STATE,
    JSON.stringify({
      cookies: [
        {
          name: SESSION_COOKIE,
          value: session.token,
          domain: "127.0.0.1",
          path: "/",
          expires: Math.floor(session.expiresAt.getTime() / 1000),
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
}
