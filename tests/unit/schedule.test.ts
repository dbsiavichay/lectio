import { describe, expect, it } from "vitest";

import {
  addDays,
  chapterReviewDates,
  daysBetween,
  isoWeek,
  relativeDay,
  skipRestDays,
  todayIn,
  weekRange,
  weekdayOf,
} from "@/lib/schedule";

describe("calendar arithmetic", () => {
  it("decides today in the user's zone, not the server's", () => {
    // 03:30 UTC on Tuesday is still Monday evening in Guayaquil (UTC−5).
    const now = new Date("2026-10-20T03:30:00Z");
    expect(todayIn("America/Guayaquil", now)).toBe("2026-10-19");
    expect(todayIn("Europe/Madrid", now)).toBe("2026-10-20");
  });

  it("adds days across months, years and DST changes", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(daysBetween("2026-10-19", "2026-11-02")).toBe(14);
  });

  it("knows the weekday", () => {
    expect(weekdayOf("2026-10-19")).toBe("mon");
    expect(weekdayOf("2026-10-25")).toBe("sun");
  });

  it("moves a date off rest days", () => {
    expect(skipRestDays("2026-10-25", ["sun"])).toBe("2026-10-26");
    expect(skipRestDays("2026-10-24", ["sat", "sun"])).toBe("2026-10-26");
    expect(skipRestDays("2026-10-21", ["sun"])).toBe("2026-10-21");
    // Seven rest days can't loop forever.
    expect(skipRestDays("2026-10-21", ["sun", "mon", "tue", "wed", "thu", "fri", "sat"])).toBe(
      "2026-10-28",
    );
  });
});

describe("chapter reviews", () => {
  it("counts +1, +3, +7 and +14 from the day the chapter was finished", () => {
    // Finished on a Wednesday.
    expect(chapterReviewDates("2026-10-21", [1, 3, 7, 14], ["sun"])).toEqual([
      { kind: "d1", dueOn: "2026-10-22" },
      { kind: "d3", dueOn: "2026-10-24" },
      { kind: "d7", dueOn: "2026-10-28" },
      { kind: "d14", dueOn: "2026-11-04" },
    ]);
  });

  it("moves a review that lands on Sunday to Monday", () => {
    // Finished on a Thursday: +3 is Sunday.
    expect(chapterReviewDates("2026-10-22", [1, 3], ["sun"])).toEqual([
      { kind: "d1", dueOn: "2026-10-23" },
      { kind: "d3", dueOn: "2026-10-26" },
    ]);
  });

  it("follows the real date when the student is late", () => {
    // The plan said week 1, but the chapter was finished a month later.
    expect(chapterReviewDates("2026-11-25", [1], ["sun"])).toEqual([
      { kind: "d1", dueOn: "2026-11-26" },
    ]);
  });
});

describe("weeks", () => {
  it("numbers ISO weeks, including the year boundary", () => {
    expect(isoWeek("2026-10-19")).toBe("2026-W43");
    expect(isoWeek("2026-10-25")).toBe("2026-W43");
    expect(isoWeek("2027-01-01")).toBe("2026-W53");
    expect(isoWeek("2027-01-04")).toBe("2027-W01");
  });

  it("finds the Monday and Sunday of a week", () => {
    expect(weekRange("2026-10-22")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(weekRange("2026-10-25")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
  });

  it("describes days relative to today", () => {
    expect(relativeDay("2026-10-19", "2026-10-19")).toBe("hoy");
    expect(relativeDay("2026-10-20", "2026-10-19")).toBe("mañana");
    expect(relativeDay("2026-10-16", "2026-10-19")).toBe("hace 3 días");
  });
});
