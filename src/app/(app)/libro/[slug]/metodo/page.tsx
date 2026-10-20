import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { Markdown } from "@/components/book/markdown";
import { PageSkeleton } from "@/components/page-skeleton";
import { BookScope } from "@/features/books/book-scope";
import { studyFor } from "@/features/study/context";

export const metadata: Metadata = { title: "Guía del método" };

export default function MethodPage({ params }: PageProps<"/libro/[slug]/metodo">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Method params={params} />
    </Suspense>
  );
}

async function Method({ params }: { params: PageProps<"/libro/[slug]/metodo">["params"] }) {
  const { slug } = await params;
  const { user, book } = await studyFor(slug);
  return (
    <BookScope userId={user.id} book={book}>
      <div className="space-y-4">
        <BackLink href="/mas">Más</BackLink>
        <Markdown
          md={book.method.guide}
          className="[&_h1]:mb-4 [&_h1]:font-serif [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_table]:block [&_table]:overflow-x-auto"
        />
      </div>
    </BookScope>
  );
}
