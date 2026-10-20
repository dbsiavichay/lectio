import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { chapterOf } from "@/content/navigation";
import type { Block } from "@/content/schema";
import { ReauthGate } from "@/features/auth/reauth-gate";
import { BookScope } from "@/features/books/book-scope";
import { EMPTY_COMMITMENT, CommitmentProvider } from "@/features/player/commitment";
import { EvaluationPlayer } from "@/features/player/evaluation-player";
import { PlayerProvider } from "@/features/player/player-context";
import { playerData } from "@/features/player/server";
import { SessionPlayer } from "@/features/player/session-player";
import { getCommitment } from "@/features/study/commitments";
import { studyFor } from "@/features/study/context";
import { getUnitProgress } from "@/features/study/progress";
import { getAuth } from "@/lib/auth/dal";
import { isPrivateUnlocked } from "@/lib/auth/session";

export default function UnitPage(props: PageProps<"/libro/[slug]/sesion/[unit]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <PageSkeleton />
        </div>
      }
    >
      <Unit {...props} />
    </Suspense>
  );
}

async function Unit({ params, searchParams }: PageProps<"/libro/[slug]/sesion/[unit]">) {
  const { slug, unit: unitId } = await params;
  const { paso } = await searchParams;
  const { user, book, enrollment } = await studyFor(slug);
  const unit = book.units[decodeURIComponent(unitId)];
  if (!unit) notFound();
  if (!enrollment) redirect("/libros");

  const chapter = chapterOf(book, unit.chapter);
  const backHref =
    unit.chapter > 0 ? `/libro/${book.slug}/capitulo/${unit.chapter}` : `/libro/${book.slug}`;
  const auth = await getAuth();
  if (chapter?.private && auth && !isPrivateUnlocked(auth.session)) {
    return (
      <main className="px-4 pt-16">
        <ReauthGate
          title="Sesión de un capítulo privado"
          description="Confirma que eres tú para abrirla. Quedará abierta durante una hora."
        />
      </main>
    );
  }

  const blocks: Block[] =
    unit.kind === "session"
      ? [
          ...unit.intro,
          ...unit.steps.flatMap((s) => s.blocks),
          ...(unit.closing?.checklist ? [unit.closing.checklist] : []),
          ...(unit.closing?.rating ? [unit.closing.rating] : []),
        ]
      : unit.blocks;
  const data = playerData(user.id, book, blocks);
  const progress = getUnitProgress(user.id, book.slug, unit.id);
  const orientation = book.orientations[String(unit.chapter)] ?? null;
  const chapterLabel =
    unit.chapter > 0
      ? `Capítulo ${unit.chapter} · ${chapter?.title ?? ""}`
      : (book.front?.title ?? "");

  const requested = Number(Array.isArray(paso) ? paso[0] : paso);
  const initialStep =
    Number.isInteger(requested) && requested >= 0
      ? requested
      : progress?.status === "in_progress"
        ? progress.currentStep
        : 0;

  const commitment =
    unit.kind === "session" ? getCommitment(user.id, book.slug, unit.id) : undefined;
  const initialCommitment = commitment
    ? {
        teaching: commitment.teaching,
        behavior: commitment.behavior,
        action: commitment.action,
        situation: commitment.situation,
        dueOn: commitment.dueOn ?? "",
        measure: commitment.measure,
        learned: commitment.learned,
      }
    : EMPTY_COMMITMENT;

  return (
    <BookScope userId={user.id} book={book}>
      <PlayerProvider
        slug={book.slug}
        unitId={unit.id}
        initialValues={data.values}
        initialRevealed={data.revealed}
        initialGrades={data.grades}
        prompts={data.prompts}
        orientation={orientation}
      >
        {unit.kind === "session" ? (
          <CommitmentProvider slug={book.slug} unitId={unit.id} initial={initialCommitment}>
            <SessionPlayer
              session={unit}
              chapterLabel={chapterLabel}
              initialStep={initialStep}
              backHref={backHref}
            />
          </CommitmentProvider>
        ) : (
          <EvaluationPlayer
            evaluation={unit}
            backHref={backHref}
            done={progress?.status === "completed"}
          />
        )}
      </PlayerProvider>
    </BookScope>
  );
}
