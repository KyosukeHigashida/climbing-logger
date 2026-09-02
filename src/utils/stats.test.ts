import { describe, expect, it } from "vitest";
import type { Attempt, Session, StrengthSet } from "../types/domain";
import {
  addMonths,
  buildOverlaySegments,
  buildActivityStats,
  getBucketCenterX,
  getBucketUnit,
  matchesEffortFilter,
  type StatsBucket,
  type StatsActivityType,
  type StatsEffortFilter,
  type StatsPeriod,
} from "./stats";

const anchorDate = new Date("2026-08-24T12:00:00.000Z");

describe("stats aggregation", () => {
  it("uses the expected bucket unit for each period", () => {
    expect(getBucketUnit("7d")).toBe("day");
    expect(getBucketUnit("30d")).toBe("day");
    expect(getBucketUnit("6m")).toBe("week");
    expect(getBucketUnit("1y")).toBe("week");
    expect(getBucketUnit("all")).toBe("month");
  });

  it("clamps calendar month arithmetic at destination month end", () => {
    expectLocalDate(addMonths(new Date(2026, 7, 31), -6), 2026, 1, 28);
    expectLocalDate(addMonths(new Date(2024, 7, 31), -6), 2024, 1, 29);
    expectLocalDate(addMonths(new Date(2026, 2, 31), -1), 2026, 1, 28);
    expectLocalDate(addMonths(new Date(2026, 0, 31), 1), 2026, 1, 28);
    expectLocalDate(addMonths(new Date(2026, 7, 15), -6), 2026, 1, 15);
  });

  it("does not roll 6M and 1Y ranges into the following month from month-end anchors", () => {
    const sixMonthRange = buildActivityStats([], [], [], {
      period: "6m",
      activityType: "activity",
      effortFilter: { label: "all", operator: ">=" },
      anchorDate: new Date(2026, 7, 31, 12),
    }).range;
    const oneYearRange = buildActivityStats([], [], [], {
      period: "1y",
      activityType: "activity",
      effortFilter: { label: "all", operator: ">=" },
      anchorDate: new Date(2026, 2, 31, 12),
    }).range;

    expect(sixMonthRange.start.getMonth()).toBe(1);
    expect(oneYearRange.start.getMonth()).toBe(2);
  });

  it("builds stacked activity counts from attempts and completed strength sets", () => {
    const stats = buildStats({
      sessions: [session("s1", "2026-08-24T09:00:00.000Z")],
      attempts: [attempt("a1", "s1", "2026-08-24T09:10:00.000Z"), attempt("a2", "s1", "2026-08-24T09:20:00.000Z")],
      strengthSets: [
        strengthSet("st1", "s1", "2026-08-24T09:30:00.000Z"),
        { ...strengthSet("active", "s1", "2026-08-24T09:40:00.000Z"), endedAt: null },
      ],
    });

    const todayBucket = stats.buckets.find((bucket) => bucket.key === "2026-08-24");
    expect(todayBucket).toMatchObject({ attemptCount: 2, strengthSetCount: 1 });
    expect(stats.totalAttempts).toBe(2);
    expect(stats.totalStrengthSets).toBe(1);
  });

  it("can show climb-only or training-only activity", () => {
    const records = {
      sessions: [session("s1", "2026-08-24T09:00:00.000Z")],
      attempts: [attempt("a1", "s1", "2026-08-24T09:10:00.000Z")],
      strengthSets: [strengthSet("st1", "s1", "2026-08-24T09:30:00.000Z")],
    };

    expect(buildStats({ ...records, activityType: "climb" }).totalAttempts).toBe(1);
    expect(buildStats({ ...records, activityType: "climb" }).totalStrengthSets).toBe(0);
    expect(buildStats({ ...records, activityType: "training" }).totalAttempts).toBe(0);
    expect(buildStats({ ...records, activityType: "training" }).totalStrengthSets).toBe(1);
  });

  it("applies effort filters and excludes records without effort when filtering", () => {
    const filter: StatsEffortFilter = { label: "hard", operator: ">=" };
    const stats = buildStats({
      sessions: [session("s1", "2026-08-24T09:00:00.000Z")],
      attempts: [
        attempt("easy", "s1", "2026-08-24T09:10:00.000Z", 1),
        attempt("hard", "s1", "2026-08-24T09:20:00.000Z", 5),
        attempt("unset", "s1", "2026-08-24T09:30:00.000Z"),
      ],
      strengthSets: [strengthSet("extreme", "s1", "2026-08-24T09:40:00.000Z", 7), strengthSet("unset-set", "s1", "2026-08-24T09:50:00.000Z")],
      effortFilter: filter,
    });

    expect(stats.totalAttempts).toBe(1);
    expect(stats.totalStrengthSets).toBe(1);
    expect(matchesEffortFilter(5, filter)).toBe(true);
    expect(matchesEffortFilter(4, filter)).toBe(false);
    expect(matchesEffortFilter(null, filter)).toBe(false);
  });

  it("buckets overnight attempts by their session start day", () => {
    const stats = buildStats({
      sessions: [session("overnight", "2026-08-23T23:30:00+09:00", 8, 4)],
      attempts: [attempt("after-midnight", "overnight", "2026-08-24T00:10:00+09:00")],
    });

    expect(stats.buckets.find((bucket) => bucket.key === "2026-08-23")).toMatchObject({
      attemptCount: 1,
      sessionRpeAverage: 8,
      performanceAverage: 4,
    });
    expect(stats.buckets.find((bucket) => bucket.key === "2026-08-24")).toMatchObject({ attemptCount: 0 });
  });

  it("buckets overnight strength sets by their session start day", () => {
    const stats = buildStats({
      sessions: [session("overnight", "2026-08-23T23:30:00+09:00")],
      strengthSets: [strengthSet("after-midnight", "overnight", "2026-08-24T00:10:00+09:00")],
    });

    expect(stats.buckets.find((bucket) => bucket.key === "2026-08-23")).toMatchObject({ strengthSetCount: 1 });
    expect(stats.buckets.find((bucket) => bucket.key === "2026-08-24")).toMatchObject({ strengthSetCount: 0 });
  });

  it("keeps normal daytime sessions in the same bucket as before", () => {
    const stats = buildStats({
      sessions: [session("daytime", "2026-08-24T09:00:00+09:00")],
      attempts: [attempt("a1", "daytime", "2026-08-24T09:30:00+09:00")],
      strengthSets: [strengthSet("st1", "daytime", "2026-08-24T10:00:00+09:00")],
    });

    expect(stats.buckets.find((bucket) => bucket.key === "2026-08-24")).toMatchObject({ attemptCount: 1, strengthSetCount: 1 });
  });

  it("excludes orphan attempts and strength sets from session-based buckets", () => {
    const stats = buildStats({
      sessions: [session("s1", "2026-08-24T09:00:00.000Z")],
      attempts: [attempt("orphan-attempt", "missing", "2026-08-24T09:30:00.000Z")],
      strengthSets: [strengthSet("orphan-set", "missing", "2026-08-24T09:45:00.000Z")],
    });

    expect(stats.totalAttempts).toBe(0);
    expect(stats.totalStrengthSets).toBe(0);
  });

  it("averages session RPE and performance per bucket independently from effort filtering", () => {
    const stats = buildStats({
      sessions: [
        session("s1", "2026-08-24T09:00:00.000Z", 8, 4),
        session("s2", "2026-08-24T12:00:00.000Z", 6, 2),
        session("missing", "2026-08-24T15:00:00.000Z", null, null),
      ],
      attempts: [attempt("a1", "s1", "2026-08-24T09:10:00.000Z", 1)],
      effortFilter: { label: "extreme", operator: "=" },
    });

    const todayBucket = stats.buckets.find((bucket) => bucket.key === "2026-08-24");
    expect(todayBucket?.attemptCount).toBe(0);
    expect(todayBucket?.sessionRpeAverage).toBe(7);
    expect(todayBucket?.performanceAverage).toBe(3);
  });

  it("uses month buckets for all-time range", () => {
    const stats = buildStats({
      period: "all",
      sessions: [session("old", "2026-01-05T09:00:00.000Z"), session("new", "2026-08-24T09:00:00.000Z")],
      attempts: [attempt("a1", "old", "2026-01-05T09:10:00.000Z")],
      strengthSets: [strengthSet("st1", "new", "2026-08-24T09:30:00.000Z")],
    });

    expect(stats.unit).toBe("month");
    expect(stats.buckets.at(0)?.key).toBe("2026-01");
    expect(stats.buckets.some((bucket) => bucket.key === "2026-08" && bucket.strengthSetCount === 1)).toBe(true);
  });

  it("keeps all-time month boundaries aligned to calendar months", () => {
    const stats = buildStats({
      period: "all",
      sessions: [session("old", "2026-01-31T09:00:00.000Z"), session("new", "2026-08-31T09:00:00.000Z")],
    });

    expect(stats.buckets.at(0)?.key).toBe("2026-01");
    expect(stats.buckets.at(-1)?.key).toBe("2026-08");
  });

  it("places overlay points at bucket centers, matching bar coordinates", () => {
    const buckets = [
      statsBucket("b1", 2),
      statsBucket("b2", 6),
      statsBucket("b3", 10),
    ];
    const barSlot = 40;
    const segments = buildOverlaySegments(buckets, "sessionRpeAverage", 10, {
      marginLeft: 20,
      marginTop: 10,
      plotHeight: 100,
      barSlot,
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].points.map((point) => point.x)).toEqual([
      getBucketCenterX(0, 20, barSlot),
      getBucketCenterX(1, 20, barSlot),
      getBucketCenterX(2, 20, barSlot),
    ]);
  });

  it("breaks overlay line segments at buckets without review values", () => {
    const segments = buildOverlaySegments(
      [
        statsBucket("recorded-a", 2),
        statsBucket("missing-a", null),
        statsBucket("missing-b", null),
        statsBucket("recorded-b", 5),
        statsBucket("recorded-c", 6),
        statsBucket("missing-c", null),
        statsBucket("recorded-d", 7),
      ],
      "sessionRpeAverage",
      10,
      { marginLeft: 10, marginTop: 0, plotHeight: 100, barSlot: 20 },
    );

    expect(segments.map((segment) => segment.points.map((point) => point.key))).toEqual([
      ["recorded-a"],
      ["recorded-b", "recorded-c"],
      ["recorded-d"],
    ]);
  });
});

function buildStats({
  sessions = [],
  attempts = [],
  strengthSets = [],
  period = "7d",
  activityType = "activity",
  effortFilter = { label: "all", operator: ">=" },
}: {
  sessions?: Session[];
  attempts?: Attempt[];
  strengthSets?: StrengthSet[];
  period?: StatsPeriod;
  activityType?: StatsActivityType;
  effortFilter?: StatsEffortFilter;
}) {
  return buildActivityStats(sessions, attempts, strengthSets, {
    period,
    activityType,
    effortFilter,
    anchorDate,
  });
}

function session(id: string, startedAt: string, sessionRpe?: number | null, performance?: number | null): Session {
  return {
    id,
    startedAt,
    endedAt: "2026-08-24T10:00:00.000Z",
    initialGymId: "gym",
    sessionRpe,
    performance,
    createdAt: startedAt,
  };
}

function attempt(id: string, sessionId: string, endedAt: string, effort?: 1 | 2 | 3 | 4 | 5 | 6 | 7): Attempt {
  return {
    id,
    sessionId,
    climbId: "climb",
    startedAt: "2026-08-24T09:00:00.000Z",
    endedAt,
    result: "fail",
    effort,
    createdAt: endedAt,
  };
}

function strengthSet(id: string, sessionId: string, endedAt: string, effort?: 1 | 2 | 3 | 4 | 5 | 6 | 7): StrengthSet {
  return {
    id,
    sessionId,
    name: "Weighted Pull-up",
    startedAt: "2026-08-24T09:00:00.000Z",
    endedAt,
    effort,
    createdAt: endedAt,
  };
}

function statsBucket(key: string, sessionRpeAverage: number | null): StatsBucket {
  return {
    key,
    label: key,
    start: new Date("2026-08-24T00:00:00.000Z"),
    end: new Date("2026-08-25T00:00:00.000Z"),
    attemptCount: 0,
    strengthSetCount: 0,
    sessionRpeAverage,
    performanceAverage: null,
  };
}

function expectLocalDate(date: Date, year: number, month: number, day: number) {
  expect(date.getFullYear()).toBe(year);
  expect(date.getMonth()).toBe(month);
  expect(date.getDate()).toBe(day);
}
