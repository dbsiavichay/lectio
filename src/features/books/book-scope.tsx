import type { ReactNode } from "react";

import { BookProvider } from "@/components/book/book-context";
import type { Book } from "@/content/schema";

import { bookClientData } from "./client-data";

/** Makes the book's sections and the user's pages available to client components. */
export function BookScope({
  userId,
  book,
  children,
}: {
  userId: string;
  book: Book;
  children: ReactNode;
}) {
  return <BookProvider data={bookClientData(userId, book)}>{children}</BookProvider>;
}
