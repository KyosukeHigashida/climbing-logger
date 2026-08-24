import { describe, expect, it } from "vitest";
import type { Attempt, Session, StrengthSet } from "../types/domain";
import {
  buildDayActivities,
  buildPeriodSummary,
  getCalendarDates,
  getMonthRange,
  getSessionsForDate,
  getWeekRange,
  toDateKey,
} from "./history";

const sessions: Session[] = [
  session("s-climb", "2026-08-05T10:00:00+09:00", "2026-08-05T12:00:00+09:00", 6, 4),
  session("s-training", "2026-08-06T10:00:00+09:00", "2026-08-06T11:00:00+09:00", null, 5),
  session("s-both", "2026-08-08T10:00:00+09:00", "2026-08-08T11:30:00+09:00", 8, null),
  session("s-extra", "2026-08-08T15:00:00+09:00", "2026-08-08T16:00:00+09:00"),
  session("s-next-month", "2026-09-01T10:00:00+09:00", "2026-09-01T11:00:00+09:00"),
  session("s-overnight", "2026-08-23T23:30:00+09:00", "2026-08-24T01:00:00+09:00"),
];

const attempts: Attempt[] = [
  attempt("a-fail", "s-climb", "fail"),
  attempt("a-send", "s-climb", "send"),
  attempt("a-both", "s-both", "send"),
  attempt("a-next", "s-next-month", "send"),
];

const strengthSets: StrengthSet[] = [
  strengthSet("set-training", "s-training"),
  strengthSet("set-both", "s-both"),
  strengthSet("set-next", "s-next-month"),
];

describe("history aggregation", () => {
  it("marks climbing-only, training-only, combined, empty, and multi-session days", () => {
    const activities = buildDayActivities(sessions, attempts, strengthSets, getMonthRange(new Date(2026, 7, 1)));

    expect(activities.get("2026-08-05")).toMatchObject({ sessionCount: 1, hasClimbing: true, hasTraining: false });
    expect(activities.get("2026-08-06")).toMatchObject({ sessionCount: 1, hasClimbing: false, hasTraining: true });
    expect(activities.get("2026-08-08")).toMatchObject({ sessionCount: 2, hasClimbing: true, hasTraining: true });
    expect(activities.get("2026-08-07")).toBeUndefined();
  });

  it("uses the session start date, including sessions that cross midnight", () => {
    expect(toDateKey(sessions.find((item) => item.id === "s-overnight")!.startedAt)).toBe("2026-08-23");
    expect(getSessionsForDate(sessions, "2026-08-23").map((item) => item.id)).toEqual(["s-overnight"]);
    expect(getSessionsForDate(sessions, "2026-08-24")).toEqual([]);
  });

  it("builds Monday-start calendar dates and supports previous/next month movement inputs", () => {
    const augustDates = getCalendarDates(new Date(2026, 7, 1));
    const septemberDates = getCalendarDates(new Date(2026, 8, 1));

    expect(toDateKey(augustDates[0])).toBe("2026-07-27");
    expect(toDateKey(augustDates[5])).toBe("2026-08-01");
    expect(toDateKey(septemberDates[0])).toBe("2026-08-31");
  });

  it("summarizes the selected week without averaging missing review values as zero", () => {
    const summary = buildPeriodSummary(sessions, attempts, strengthSets, getWeekRange(new Date(2026, 7, 5)));

    expect(summary).toMatchObject({
      sessionCount: 4,
      activeDays: 3,
      attemptCount: 3,
      sendCount: 2,
      strengthSetCount: 2,
      averageSessionRpe: 7,
      averagePerformance: 4.5,
    });
    expect(summary.totalDurationMs).toBe(5.5 * 60 * 60 * 1000);
  });

  it("summarizes the visible month", () => {
    const summary = buildPeriodSummary(sessions, attempts, strengthSets, getMonthRange(new Date(2026, 7, 1)));

    expect(summary.sessionCount).toBe(5);
    expect(summary.activeDays).toBe(4);
    expect(summary.attemptCount).toBe(3);
    expect(summary.sendCount).toBe(2);
    expect(summary.strengthSetCount).toBe(2);
  });
});

function session(
  id: string,
  startedAt: string,
  endedAt: string,
  sessionRpe?: number | null,
  performance?: number | null,
): Session {
  return {
    id,
    startedAt,
    endedAt,
    sessionRpe,
    performance,
    createdAt: startedAt,
  };
}

function attempt(id: string, sessionId: string, result: "fail" | "send"): Attempt {
  return {
    id,
    sessionId,
    climbId: `${sessionId}-climb`,
    startedAt: "2026-08-05T10:00:00+09:00",
    endedAt: "2026-08-05T10:01:00+09:00",
    result,
    createdAt: "2026-08-05T10:00:00+09:00",
  };
}

function strengthSet(id: string, sessionId: string): StrengthSet {
  return {
    id,
    sessionId,
    name: "Pull-up",
    startedAt: "2026-08-06T10:00:00+09:00",
    endedAt: "2026-08-06T10:01:00+09:00",
    createdAt: "2026-08-06T10:00:00+09:00",
  };
}
