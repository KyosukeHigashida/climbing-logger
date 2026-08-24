import { describe, expect, it } from "vitest";
import type { Attempt, Session, StrengthSet } from "../types/domain";
import {
  buildActivityStats,
  getBucketUnit,
  matchesEffortFilter,
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
