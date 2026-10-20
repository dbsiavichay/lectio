import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { BookMap } from "@/features/books/book-map";
import { currentStudy } from "@/features/study/context";

export const metadata: Metadata = { title: "Libro" };

export default function CurrentBookPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CurrentBook />
    </Suspense>
  );
}

async function CurrentBook() {
  const { user, book } = await currentStudy();
  if (!book) redirect("/libros");
  return <BookMap userId={user.id} book={book} />;
}
