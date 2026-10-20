import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  answerChecks,
  commitments,
  enrollments,
  fieldValues,
  passkeys,
  reviewTasks,
  sectionPages,
  unitProgress,
} from "@/db/schema";
import { getAuth } from "@/lib/auth/dal";
import { isRecentlyVerified } from "@/lib/auth/session";

/** Everything the user wrote, as JSON. Needs a password or passkey check in the last minutes. */
export async function GET() {
  const auth = await getAuth();
  if (!auth) return new Response("No autorizado", { status: 401 });
  if (!isRecentlyVerified(auth.session))
    return new Response("Confirma tu identidad en Ajustes antes de descargar.", { status: 403 });
  const id = auth.user.id;
  const conn = db();
  const data = {
    exportedAt: new Date().toISOString(),
    app: "Lectio",
    user: {
      username: auth.user.username,
      displayName: auth.user.displayName,
      timezone: auth.user.timezone,
    },
    enrollments: conn.select().from(enrollments).where(eq(enrollments.userId, id)).all(),
    progress: conn.select().from(unitProgress).where(eq(unitProgress.userId, id)).all(),
    fields: conn.select().from(fieldValues).where(eq(fieldValues.userId, id)).all(),
    answerChecks: conn.select().from(answerChecks).where(eq(answerChecks.userId, id)).all(),
    commitments: conn.select().from(commitments).where(eq(commitments.userId, id)).all(),
    reviews: conn.select().from(reviewTasks).where(eq(reviewTasks.userId, id)).all(),
    sectionPages: conn.select().from(sectionPages).where(eq(sectionPages.userId, id)).all(),
    passkeys: conn
      .select({ name: passkeys.name, createdAt: passkeys.createdAt })
      .from(passkeys)
      .where(eq(passkeys.userId, id))
      .all(),
  };
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="lectio-${auth.user.username}-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
