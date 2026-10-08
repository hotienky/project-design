import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/server/db/client";

/** Liveness + database reachability, used by the Docker healthcheck. */
export async function GET() {
  // With Cache Components a GET handler without request data is prerendered at
  // build time; connection() keeps it per-request.
  await connection();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[health]", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
