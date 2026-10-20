import "server-only";

import { chapterEvaluation, chapterSessions } from "@/content/navigation";
import type { Book } from "@/content/schema";

import { isDone, type UnitProgress } from "./progress";

export type ChapterStatus = "not_started" | "in_progress" | "needs_review" | "completed";

export function chapterStatus(book: Book, chapter: number, progress: Map<string, UnitProgress>) {
  const sessions = chapterSessions(book, chapter);
  const done = sessions.filter((s) => isDone(progress.get(s.id))).length;
  const started = sessions.some((s) => progress.has(s.id));
  const ratings = sessions
    .map((s) => progress.get(s.id)?.rating)
    .filter((r): r is number => typeof r === "number");
  const evaluation = chapterEvaluation(book, chapter);
  const status: ChapterStatus = sessions.some((s) => progress.get(s.id)?.status === "needs_review")
    ? "needs_review"
    : done === sessions.length && sessions.length > 0
      ? "completed"
      : started
        ? "in_progress"
        : "not_started";
  return {
    status,
    done,
    total: sessions.length,
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    evaluationDone: evaluation ? progress.get(evaluation.id)?.status === "completed" : false,
  };
}
