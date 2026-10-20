import { CalendarClock, Check, RotateCcw } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Book } from "@/content/schema";
import { currentStudy } from "@/features/study/context";
import {
  REVIEW_MINUTES,
  listReviews,
  reviewSlug,
  reviewTitle,
  type ReviewTask,
} from "@/features/study/reviews";
import { formatDate, relativeDay, todayIn } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Repasos" };

export default function ReviewsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Reviews />
    </Suspense>
  );
}

async function Reviews() {
  const { user, book } = await currentStudy();
  if (!book) redirect("/libros");
  const today = todayIn(user.timezone);
  const all = listReviews(user.id, book.slug);
  const pending = all.filter((r) => !r.completedAt && r.dueOn <= today);
  const upcoming = all.filter((r) => !r.completedAt && r.dueOn > today);
  const done = all.filter((r) => r.completedAt).reverse();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Repasos</h1>
        <p className="text-muted-foreground">Repasar a tiempo es lo que fija lo que estudiaste.</p>
      </header>
      <Tabs defaultValue="pending">
        <TabsList className="grid h-11 w-full grid-cols-3">
          <TabsTrigger value="pending">
            Pendientes{pending.length ? ` (${pending.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="upcoming">Próximos</TabsTrigger>
          <TabsTrigger value="done">Hechos</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <ReviewRows
            book={book}
            tasks={pending}
            today={today}
            empty="No tienes repasos pendientes. ¡Vas al día!"
          />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4">
          <ReviewRows
            book={book}
            tasks={upcoming}
            today={today}
            empty="Los repasos aparecen cuando terminas la última sesión de un capítulo."
          />
        </TabsContent>
        <TabsContent value="done" className="mt-4">
          <ReviewRows
            book={book}
            tasks={done}
            today={today}
            empty="Todavía no has hecho repasos."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewRows({
  book,
  tasks,
  today,
  empty,
}: {
  book: Book;
  tasks: ReviewTask[];
  today: string;
  empty: string;
}) {
  if (!tasks.length)
    return (
      <p className="rounded-xl bg-muted p-5 text-center text-sm text-muted-foreground">{empty}</p>
    );
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const { title, subtitle } = reviewTitle(book, t);
        const privateChapter =
          t.kind.startsWith("d") && book.chapters.find((c) => c.n === t.ref)?.private;
        const overdue = !t.completedAt && t.dueOn < today;
        return (
          <li key={t.id}>
            <Link
              href={`/libro/${book.slug}/repaso/${reviewSlug(t)}` as Route}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  t.completedAt ? "bg-success/15 text-success" : "bg-accent text-accent-foreground",
                )}
              >
                {t.completedAt ? (
                  <Check className="size-5" />
                ) : t.dueOn > today ? (
                  <CalendarClock className="size-5" />
                ) : (
                  <RotateCcw className="size-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {privateChapter ? "Capítulo privado" : subtitle}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <span className="block text-muted-foreground first-letter:uppercase">
                  {t.completedAt
                    ? formatDate(t.completedAt.toISOString().slice(0, 10), {
                        day: "numeric",
                        month: "short",
                      })
                    : relativeDay(t.dueOn, today)}
                </span>
                {!t.completedAt && (
                  <span
                    className={cn(
                      "block text-xs",
                      overdue ? "font-medium text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {overdue ? "Atrasado" : `${REVIEW_MINUTES[t.kind]} min`}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
