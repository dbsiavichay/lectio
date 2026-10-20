import "server-only";

import {
  chapterOf,
  isSession,
  orderedUnits,
  requiredSessions,
  unitLabel,
} from "@/content/navigation";
import type { Book } from "@/content/schema";
import { addDays, daysBetween, formatDate, isoWeek, todayIn, weekdayOf } from "@/lib/schedule";

import { listCommitments } from "./commitments";
import type { Enrollment } from "./enrollment";
import { getFieldsByPrefix } from "./fields";
import { getProgress, isDone } from "./progress";
import { REVIEW_MINUTES, pendingReviews, reviewSlug, reviewTitle } from "./reviews";

export type TodayReview = {
  slug: string;
  title: string;
  subtitle: string;
  minutes: number;
  dueOn: string;
  overdue: boolean;
};

export type TodayView = {
  today: string;
  todayLabel: string;
  isStudyDay: boolean;
  next: {
    unitId: string;
    label: string;
    title: string;
    chapter: number;
    chapterTitle: string;
    minutes: number;
    resumeStep: number | null;
  } | null;
  reinforce: { unitId: string; label: string; title: string; beforeAdvancing: string | null }[];
  reviews: TodayReview[];
  upcoming: TodayReview[];
  commitments: {
    unitId: string;
    action: string;
    dueOn: string | null;
    overdue: boolean;
    privateChapter: boolean;
  }[];
  weekly: { week: string; done: boolean; show: boolean };
  minutes: number;
  heavy: boolean;
  progress: { done: number; total: number; percent: number };
  finished: boolean;
};

/** Everything the "Hoy" screen shows, decided from the user's date. */
export function computeToday(
  userId: string,
  timezone: string,
  book: Book,
  enrollment: Enrollment,
): TodayView {
  const today = todayIn(timezone);
  const weekday = weekdayOf(today);
  const progress = getProgress(userId, book.slug);

  // Resume what is in progress first; otherwise the first required session not done.
  const sessions = orderedUnits(book).filter(isSession);
  const inProgress = sessions.find((s) => progress.get(s.id)?.status === "in_progress");
  const pending = inProgress ?? requiredSessions(book).find((s) => !isDone(progress.get(s.id)));
  const isPrivate = (chapter: number) => Boolean(chapterOf(book, chapter)?.private);
  const next = pending
    ? {
        unitId: pending.id,
        label: unitLabel(pending),
        // Private chapters keep their titles off the home screen.
        title: isPrivate(pending.chapter) ? "Sesión de un capítulo privado" : pending.title,
        chapter: pending.chapter,
        chapterTitle:
          pending.chapter === 0
            ? (book.front?.title ?? "")
            : isPrivate(pending.chapter)
              ? "Se abre tras confirmar tu identidad"
              : (chapterOf(book, pending.chapter)?.title ?? ""),
        minutes: pending.minutes,
        resumeStep:
          progress.get(pending.id)?.status === "in_progress"
            ? (progress.get(pending.id)?.currentStep ?? 1)
            : null,
      }
    : null;

  const reinforce = sessions
    .filter((s) => progress.get(s.id)?.status === "needs_review")
    .map((s) => ({
      unitId: s.id,
      label: unitLabel(s),
      title: isPrivate(s.chapter) ? "Capítulo privado" : s.title,
      beforeAdvancing: isPrivate(s.chapter) ? null : (s.closing?.beforeAdvancing ?? null),
    }));

  const toReview = (t: ReturnType<typeof pendingReviews>[number]): TodayReview => {
    const { title, subtitle } = reviewTitle(book, t);
    return {
      slug: reviewSlug(t),
      title,
      subtitle: t.kind.startsWith("d") && isPrivate(t.ref) ? "Capítulo privado" : subtitle,
      minutes: REVIEW_MINUTES[t.kind],
      dueOn: t.dueOn,
      overdue: t.dueOn < today,
    };
  };
  const pendingTasks = pendingReviews(userId, book.slug);
  const reviews = pendingTasks.filter((t) => t.dueOn <= today).map(toReview);
  const upcoming = pendingTasks
    .filter((t) => t.dueOn > today && t.dueOn <= addDays(today, 7))
    .map(toReview);

  const commitments = listCommitments(userId, book.slug)
    .filter(
      (c) =>
        c.status === "pending" && c.action.trim() && (!c.dueOn || c.dueOn <= addDays(today, 2)),
    )
    .map((c) => ({
      unitId: c.unitId,
      action: c.action,
      dueOn: c.dueOn,
      overdue: Boolean(c.dueOn && c.dueOn < today),
      privateChapter: isPrivate(book.units[c.unitId]?.chapter ?? -1),
    }));

  const week = isoWeek(today);
  const weeklyDone = Object.keys(getFieldsByPrefix(userId, book.slug, `w:${week}:`)).length > 0;

  const isStudyDay = enrollment.studyDays.includes(weekday);
  const minutes =
    reviews.reduce((sum, r) => sum + r.minutes, 0) +
    (next && (isStudyDay || next.resumeStep) ? next.minutes : 0);

  const required = requiredSessions(book);
  const done = required.filter((s) => isDone(progress.get(s.id))).length;

  return {
    today,
    todayLabel: formatDate(today),
    isStudyDay,
    next,
    reinforce,
    reviews,
    upcoming,
    commitments,
    weekly: {
      week,
      done: weeklyDone,
      show: (weekday === "sat" || weekday === "sun") && !weeklyDone,
    },
    minutes,
    heavy: minutes > book.method.dailyLoadWarningMinutes,
    progress: {
      done,
      total: required.length,
      percent: required.length ? Math.round((done / required.length) * 100) : 0,
    },
    finished: !next && pendingTasks.length === 0 && done === required.length,
  };
}

export const daysLate = (dueOn: string, today: string) => Math.max(0, daysBetween(dueOn, today));
