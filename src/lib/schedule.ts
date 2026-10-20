/**
 * Calendar arithmetic for spaced reviews. Dates are plain `YYYY-MM-DD`
 * strings in the user's time zone: "today" is decided once, from the zone,
 * and everything after is day counting, immune to DST and server zones.
 */

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  mon: { short: "L", long: "lunes" },
  tue: { short: "M", long: "martes" },
  wed: { short: "X", long: "miércoles" },
  thu: { short: "J", long: "jueves" },
  fri: { short: "V", long: "viernes" },
  sat: { short: "S", long: "sábado" },
  sun: { short: "D", long: "domingo" },
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar date in a time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtc(date: string): Date {
  if (!DATE.test(date)) throw new Error(`Fecha inválida: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[toUtc(date).getUTCDay()]!;
}

/** The date itself, or the next one that is not a rest day. */
export function skipRestDays(date: string, restDays: readonly Weekday[]): string {
  let d = date;
  for (let i = 0; i < 7 && restDays.includes(weekdayOf(d)); i++) d = addDays(d, 1);
  return d;
}

export type ChapterReviewKind = "d1" | "d3" | "d7" | "d14";

/**
 * A chapter's reviews, counted from the day its last session was done.
 * A review that lands on a rest day moves to the next day.
 */
export function chapterReviewDates(
  completedOn: string,
  offsets: readonly number[],
  restDays: readonly Weekday[],
): { kind: ChapterReviewKind; dueOn: string }[] {
  return offsets.map((offset) => ({
    kind: `d${offset}` as ChapterReviewKind,
    dueOn: skipRestDays(addDays(completedOn, offset), restDays),
  }));
}

/** ISO 8601 week, "2026-W43": the weekly log is one per week. */
export function isoWeek(date: string): string {
  const d = toUtc(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday and Sunday of the ISO week a date belongs to. */
export function weekRange(date: string): { start: string; end: string } {
  const day = toUtc(date).getUTCDay() || 7;
  const start = addDays(date, 1 - day);
  return { start, end: addDays(start, 6) };
}

export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
): string {
  return new Intl.DateTimeFormat("es", { ...options, timeZone: "UTC" }).format(toUtc(date));
}

/** "hoy", "mañana", "ayer", "en 3 días", "hace 2 días". */
export function relativeDay(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  return diff > 0 ? `en ${diff} días` : `hace ${-diff} días`;
}
