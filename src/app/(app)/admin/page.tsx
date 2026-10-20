import { asc } from "drizzle-orm";
import { BookUp, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionTitle } from "@/components/section-title";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";

import { CreateUserForm, UserRow } from "./users-client";

export const metadata: Metadata = { title: "Administración" };

export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Admin />
    </Suspense>
  );
}

async function Admin() {
  const admin = await requireAdmin();
  const all = db()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt))
    .all();
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <BackLink href="/mas">Más</BackLink>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Administración</h1>
      </header>
      <Link
        href="/admin/libros"
        className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/40"
      >
        <BookUp className="size-6 text-primary" />
        <span className="flex-1">
          <span className="block font-medium">Libros</span>
          <span className="text-sm text-muted-foreground">
            Importar un libro nuevo o una versión corregida
          </span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
      <section>
        <SectionTitle>Usuarios ({all.length})</SectionTitle>
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {all.map((u) => (
            <UserRow
              key={u.id}
              user={{ ...u, createdAt: u.createdAt.toISOString() }}
              self={u.id === admin.id}
            />
          ))}
        </ul>
      </section>
      <section>
        <SectionTitle>Nuevo usuario</SectionTitle>
        <CreateUserForm />
      </section>
    </div>
  );
}
