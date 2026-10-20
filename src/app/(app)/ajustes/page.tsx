import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionTitle } from "@/components/section-title";
import { db } from "@/db/client";
import { passkeys } from "@/db/schema";
import { requireAuth } from "@/lib/auth/dal";
import { isRecentlyVerified } from "@/lib/auth/session";

import {
  AppearanceSettings,
  ExportData,
  PasskeySettings,
  PasswordSettings,
  TimezoneSettings,
} from "./settings-client";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const { user, session } = await requireAuth();
  const keys = db()
    .select({
      id: passkeys.id,
      name: passkeys.name,
      createdAt: passkeys.createdAt,
      lastUsedAt: passkeys.lastUsedAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, user.id))
    .orderBy(asc(passkeys.createdAt))
    .all()
    .map((k) => ({
      ...k,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    }));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <BackLink href="/mas">Más</BackLink>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Ajustes</h1>
      </header>
      <section>
        <SectionTitle>Apariencia</SectionTitle>
        <AppearanceSettings />
      </section>
      <section>
        <SectionTitle>Zona horaria</SectionTitle>
        <TimezoneSettings current={user.timezone} />
      </section>
      <section>
        <SectionTitle>Passkeys</SectionTitle>
        <PasskeySettings passkeys={keys} />
      </section>
      <section>
        <SectionTitle>Contraseña</SectionTitle>
        <PasswordSettings />
      </section>
      <section>
        <SectionTitle>Tus datos</SectionTitle>
        <ExportData verified={isRecentlyVerified(session)} />
      </section>
    </div>
  );
}
