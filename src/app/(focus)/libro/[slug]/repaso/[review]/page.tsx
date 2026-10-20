import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { chapterEvaluation, chapterOf, chapterSessions } from "@/content/navigation";
import { ReauthGate } from "@/features/auth/reauth-gate";
import { BookScope } from "@/features/books/book-scope";
import { PlayerProvider } from "@/features/player/player-context";
import { ReviewPlayer, type ReviewSection } from "@/features/player/review-player";
import { playerData } from "@/features/player/server";
import { listCommitments } from "@/features/study/commitments";
import { studyFor } from "@/features/study/context";
import { getProgress } from "@/features/study/progress";
import { findReview, parseReviewSlug, reviewTitle } from "@/features/study/reviews";
import { getAuth } from "@/lib/auth/dal";
import { isPrivateUnlocked } from "@/lib/auth/session";

const STATUS: Record<string, string> = {
  pending: "pendiente",
  done: "cumplido",
  partial: "cumplido en parte",
  not_done: "no cumplido",
};

export default function ReviewPage(props: PageProps<"/libro/[slug]/repaso/[review]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <PageSkeleton />
        </div>
      }
    >
      <Review {...props} />
    </Suspense>
  );
}

async function Review({ params }: PageProps<"/libro/[slug]/repaso/[review]">) {
  const { slug, review } = await params;
  const { user, book } = await studyFor(slug);
  const key = parseReviewSlug(review);
  if (!key) notFound();

  let sections: ReviewSection[] = [];
  let evaluation: { href: string; done: boolean } | undefined;
  let commitments: { unitLabel: string; action: string; status: string }[] | undefined;
  let backHref = "/repasos";

  if (key.kind === "block") {
    const block = book.reviews.blocks[String(key.ref)];
    if (!block) notFound();
    sections = [{ intro: book.reviews.intro, blocks: block.blocks }];
  } else if (key.kind === "final") {
    if (!book.reviews.final) notFound();
    sections = [
      { intro: book.reviews.final.intro, blocks: [] },
      ...book.reviews.final.sections.map((s) => ({ title: s.title, blocks: s.blocks })),
    ];
  } else {
    const card = book.reviews.cards[String(key.ref)];
    const chapter = chapterOf(book, key.ref);
    if (!card || !chapter) notFound();
    const auth = await getAuth();
    if (chapter.private && auth && !isPrivateUnlocked(auth.session)) {
      return (
        <main className="px-4 pt-16">
          <ReauthGate
            title="Repaso de un capítulo privado"
            description="Confirma que eres tú para abrirlo. Quedará abierto durante una hora."
          />
        </main>
      );
    }
    sections = [{ blocks: card[key.kind] }];
    backHref = `/libro/${book.slug}/capitulo/${key.ref}`;
    if (key.kind === "d1") {
      const ef = chapterEvaluation(book, key.ref);
      if (ef)
        evaluation = {
          href: `/libro/${book.slug}/sesion/${ef.id}`,
          done: getProgress(user.id, book.slug).get(ef.id)?.status === "completed",
        };
    }
    if (key.kind === "d14") {
      const sessionIds = new Map(chapterSessions(book, key.ref).map((s) => [s.id, s.number]));
      commitments = listCommitments(user.id, book.slug)
        .filter((c) => sessionIds.has(c.unitId))
        .map((c) => ({
          unitLabel: `Sesión ${sessionIds.get(c.unitId)}`,
          action: c.action,
          status: STATUS[c.status] ?? c.status,
        }));
    }
  }

  const task = findReview(user.id, book.slug, key);
  const { title, subtitle } = reviewTitle(book, key);
  const data = playerData(
    user.id,
    book,
    sections.flatMap((s) => s.blocks),
  );

  return (
    <BookScope userId={user.id} book={book}>
      <PlayerProvider
        slug={book.slug}
        unitId={`review:${review}`}
        initialValues={data.values}
        initialRevealed={data.revealed}
        initialGrades={data.grades}
        prompts={data.prompts}
        orientation={null}
      >
        <ReviewPlayer
          title={title}
          subtitle={subtitle}
          sections={sections}
          reviewSlug={review}
          scheduled={Boolean(task)}
          initiallyDone={Boolean(task?.completedAt)}
          evaluation={evaluation}
          commitments={commitments}
          backHref={backHref}
        />
      </PlayerProvider>
    </BookScope>
  );
}
