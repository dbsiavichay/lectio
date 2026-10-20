import { BookOpen, Check } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { getBook, listBooks } from "@/features/books/queries";
import { currentBookSlug, listEnrollments } from "@/features/study/enrollment";
import { requireUser } from "@/lib/auth/dal";

import { EnrollSheet, OpenBookButton } from "./enroll";

export const metadata: Metadata = { title: "Biblioteca" };

export default function LibraryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Library />
    </Suspense>
  );
}

async function Library() {
  const user = await requireUser();
  const books = listBooks();
  const enrollments = new Map(listEnrollments(user.id).map((e) => [e.bookSlug, e]));
  const current = currentBookSlug(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Biblioteca</h1>
        <p className="text-muted-foreground">Los libros que puedes estudiar con Lectio.</p>
      </header>
      {books.length === 0 && (
        <p className="rounded-xl border bg-card p-5 text-muted-foreground">
          Todavía no hay libros. Quien administra Lectio puede importarlos desde Administración.
        </p>
      )}
      <ul className="space-y-3">
        {books.map((b) => {
          const book = getBook(b.slug)!;
          const enrollment = enrollments.get(b.slug);
          const sessions = Object.values(book.units).filter(
            (u) => u.kind === "session" && !u.optional,
          ).length;
          return (
            <li key={b.slug} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <BookOpen className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-lg leading-snug font-semibold">{book.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {book.author}
                    {book.edition ? ` · ${book.edition}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {book.chapters.length} capítulos · {sessions} sesiones de{" "}
                    {book.method.sessionMinutes} min
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {enrollment ? (
                  <>
                    {current === b.slug ? (
                      <span className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-success/12 px-3 text-sm font-medium text-success">
                        <Check className="size-4" /> Libro actual
                      </span>
                    ) : (
                      <OpenBookButton slug={b.slug} />
                    )}
                    <EnrollSheet
                      slug={b.slug}
                      title={book.title}
                      sessions={sessions}
                      initialStudyDays={enrollment.studyDays}
                      initialRestDays={enrollment.restDays}
                      mode="edit"
                    />
                  </>
                ) : (
                  <EnrollSheet
                    slug={b.slug}
                    title={book.title}
                    sessions={sessions}
                    initialStudyDays={book.method.defaultStudyDays}
                    initialRestDays={book.method.defaultRestDays}
                    mode="start"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
