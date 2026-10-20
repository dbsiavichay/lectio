import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db/client";
import { env } from "@/lib/env";

/** Liveness and readiness in one: the deploy waits for a 200 before switching. */
export async function GET() {
  await connection();
  try {
    db().get(sql`select 1`);
    return Response.json(
      { status: "ok", version: env.BUILD_SHA },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
