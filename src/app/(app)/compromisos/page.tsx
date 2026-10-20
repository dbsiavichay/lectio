import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { SectionTitle } from "@/components/section-title";
import { listCommitments } from "@/features/study/commitments";
import { currentStudy } from "@/features/study/context";
import { todayIn } from "@/lib/schedule";

import { CommitmentCard, type CommitmentView } from "./commitment-card";

export const metadata: Metadata = { title: "Compromisos" };

export default function CommitmentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Commitments />
    </Suspense>
  );
}

async function Commitments() {
  const { user, book } = await currentStudy();
  if (!book) redirect("/libros");
  const today = todayIn(user.timezone);
  const views: CommitmentView[] = listCommitments(user.id, book.slug)
    .filter((c) => c.action.trim() || c.teaching.trim())
    .map((c) => {
      const unit = book.units[c.unitId];
      const chapter = unit ? book.chapters.find((ch) => ch.n === unit.chapter) : undefined;
      return {
        unitId: c.unitId,
        label: unit?.kind === "session" ? `Sesión ${unit.number}` : c.unitId,
        privateChapter: Boolean(chapter?.private),
        teaching: c.teaching,
        behavior: c.behavior,
        action: c.action,
        situation: c.situation,
        dueOn: c.dueOn,
        measure: c.measure,
        learned: c.learned,
        status: c.status,
        observed: c.observed,
        keepAsHabit: c.keepAsHabit,
      };
    });

  const due = views.filter((c) => c.status === "pending" && c.dueOn && c.dueOn <= today);
  const active = views.filter((c) => c.status === "pending" && !(c.dueOn && c.dueOn <= today));
  const habits = views.filter((c) => c.status !== "pending" && c.keepAsHabit);
  const reviewed = views.filter((c) => c.status !== "pending" && !c.keepAsHabit);

  const groups = [
    { title: "Por revisar", items: due },
    { title: "En curso", items: active },
    { title: "Hábitos", items: habits },
    { title: "Revisados", items: reviewed },
  ].filter((g) => g.items.length);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Compromisos</h1>
        <p className="text-muted-foreground">
          Una acción pequeña y verificable vale más que muchas buenas intenciones.
        </p>
      </header>
      {groups.length === 0 && (
        <p className="rounded-xl bg-muted p-5 text-center text-sm text-muted-foreground">
          Aquí aparecerán las acciones que definas en el paso 5 de cada sesión.
        </p>
      )}
      {groups.map((g) => (
        <section key={g.title}>
          <SectionTitle>
            {g.title} ({g.items.length})
          </SectionTitle>
          <ul className="space-y-2">
            {g.items.map((c) => (
              <li key={c.unitId}>
                <CommitmentCard slug={book.slug} commitment={c} today={today} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
