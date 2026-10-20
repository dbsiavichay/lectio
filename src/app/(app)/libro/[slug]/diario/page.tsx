import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionTitle } from "@/components/section-title";
import { scopeKeys } from "@/content/navigation";
import { BookScope } from "@/features/books/book-scope";
import { Blocks } from "@/features/player/block-view";
import { PlayerProvider } from "@/features/player/player-context";
import { SaveStatusBar } from "@/features/player/save-status-bar";
import { studyFor } from "@/features/study/context";
import { getFields, getFieldsByPrefix } from "@/features/study/fields";
import { formatDate, isoWeek, todayIn, weekRange } from "@/lib/schedule";
import { blockKeys } from "@/content/navigation";

export const metadata: Metadata = { title: "Diario semanal" };

export default function JournalPage({ params }: PageProps<"/libro/[slug]/diario">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Journal params={params} />
    </Suspense>
  );
}

async function Journal({ params }: { params: PageProps<"/libro/[slug]/diario">["params"] }) {
  const { slug } = await params;
  const { user, book } = await studyFor(slug);
  const today = todayIn(user.timezone);
  const week = isoWeek(today);
  const prefix = `w:${week}:`;
  const blocks = scopeKeys(book.reviews.weekly, prefix);
  const values = getFields(user.id, book.slug, blocks.flatMap(blockKeys));
  const range = weekRange(today);

  // Labels of the template's fields, to show past weeks.
  const labels = new Map<string, string>();
  for (const b of book.reviews.weekly) {
    if (b.type === "fields") for (const i of b.items) labels.set(i.key, i.label);
    else if (b.type === "text") labels.set(b.key, b.label);
  }
  const past = new Map<string, { key: string; value: string }[]>();
  for (const [key, value] of Object.entries(getFieldsByPrefix(user.id, book.slug, "w:"))) {
    const m = key.match(/^w:(\d{4}-W\d{2}):(.+)$/);
    if (!m || m[1] === week) continue;
    past.set(m[1]!, [...(past.get(m[1]!) ?? []), { key: m[2]!, value }]);
  }
  const pastWeeks = [...past.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <BookScope userId={user.id} book={book}>
      <div className="space-y-8">
        <header className="space-y-1">
          <BackLink href="/mas">Más</BackLink>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Diario semanal</h1>
          <p className="text-muted-foreground">
            Semana del {formatDate(range.start, { day: "numeric", month: "long" })} al{" "}
            {formatDate(range.end, { day: "numeric", month: "long" })}
          </p>
        </header>
        <PlayerProvider
          slug={book.slug}
          unitId={`weekly:${week}`}
          initialValues={values}
          initialRevealed={{}}
          initialGrades={{}}
          prompts={{}}
          orientation={null}
        >
          <Blocks blocks={blocks} />
          <SaveStatusBar />
        </PlayerProvider>
        {pastWeeks.length > 0 && (
          <section>
            <SectionTitle>Semanas anteriores</SectionTitle>
            <ul className="space-y-3">
              {pastWeeks.map(([w, entries]) => (
                <li key={w}>
                  <details className="rounded-xl border bg-card">
                    <summary className="cursor-pointer p-4 font-medium">
                      Semana {w.split("-W")[1]} de {w.split("-W")[0]}
                    </summary>
                    <dl className="space-y-3 border-t p-4">
                      {entries.map((e) => (
                        <div key={e.key}>
                          <dt className="text-xs text-muted-foreground">
                            {labels.get(e.key) ?? e.key}
                          </dt>
                          <dd className="prose-reading whitespace-pre-wrap">{e.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </BookScope>
  );
}
