import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionTitle } from "@/components/section-title";
import { listBooks } from "@/features/books/queries";
import { requireAdmin } from "@/lib/auth/dal";

import { ImportBookForm } from "./import-form";

export const metadata: Metadata = { title: "Libros" };

export default function AdminBooksPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminBooks />
    </Suspense>
  );
}

async function AdminBooks() {
  await requireAdmin();
  const books = listBooks();
  const fmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <BackLink href="/admin">Administración</BackLink>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Libros</h1>
      </header>
      <section>
        <SectionTitle>Importados</SectionTitle>
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {books.map((b) => (
            <li key={b.slug} className="px-4 py-3">
              <p className="font-medium">{b.title}</p>
              <p className="text-sm text-muted-foreground">
                {b.slug} · versión {b.version} · {fmt.format(b.importedAt)}
              </p>
            </li>
          ))}
          {books.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">Ninguno todavía.</li>
          )}
        </ul>
      </section>
      <section>
        <SectionTitle>Importar</SectionTitle>
        <ImportBookForm />
      </section>
    </div>
  );
}
