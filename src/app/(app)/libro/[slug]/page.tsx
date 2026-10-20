import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { BookMap } from "@/features/books/book-map";
import { studyFor } from "@/features/study/context";

export default function BookPage({ params }: PageProps<"/libro/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Book params={params} />
    </Suspense>
  );
}

async function Book({ params }: { params: PageProps<"/libro/[slug]">["params"] }) {
  const { slug } = await params;
  const { user, book } = await studyFor(slug);
  return <BookMap userId={user.id} book={book} />;
}
