import type { Attempt, EffortRating, Session, StrengthSet } from "../types/domain";
import { isCompletedAttempt } from "./attempts";

export type StatsActivityType = "activity" | "climb" | "training";
export type StatsPeriod = "7d" | "30d" | "6m" | "1y" | "all";
export type StatsBucketUnit = "day" | "week" | "month";
export type EffortFilterLabel = "all" | "easy" | "moderate" | "hard" | "extreme";
export type EffortFilterOperator = "=" | ">=" | "<=";

export type StatsEffortFilter = {
  label?: EffortFilterLabel;
  value?: EffortRating | "all";
  operator: EffortFilterOperator;
};

export type StatsBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  attemptCount: number;
  strengthSetCount: number;
  sessionRpeAverage: number | null;
  performanceAverage: number | null;
};

export type ActivityStats = {
  period: StatsPeriod;
  unit: StatsBucketUnit;
  range: {
    start: Date;
    end: Date;
  };
  buckets: StatsBucket[];
  totalAttempts: number;
  totalStrengthSets: number;
  hasRecordsInRange: boolean;
};

export type StatsOverlayMetricKey = "sessionRpeAverage" | "performanceAverage";

export type StatsOverlayPoint = {
  key: string;
  label: string;
  value: number;
  x: number;
  y: number;
};

export type StatsOverlaySegment = {
  points: StatsOverlayPoint[];
};

export const effortFilterThresholds: Record<Exclude<EffortFilterLabel, "all">, EffortRating> = {
  easy: 1,
  moderate: 3,
  hard: 5,
  extreme: 7,
};

export function buildActivityStats(
  sessions: Session[],
  attempts: Attempt[],
  strengthSets: StrengthSet[],
  options: {
    period: StatsPeriod;
    activityType: StatsActivityType;
    effortFilter: StatsEffortFilter;
    anchorDate?: Date;
  },
): ActivityStats {
  const anchorDate = options.anchorDate ?? new Date();
  const completedAttempts = attempts.filter(isCompletedAttempt);
  const completedStrengthSets = strengthSets.filter((set) => set.endedAt !== null);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const unit = getBucketUnit(options.period);
  const range = getStatsRange(options.period, anchorDate, sessions, completedAttempts, completedStrengthSets);
  const buckets = createBuckets(range, unit);

  for (const attempt of completedAttempts) {
    if (options.activityType === "training" || !matchesEffortFilter(attempt.effort ?? null, options.effortFilter)) {
      continue;
    }
    const sessionStartedAt = sessionById.get(attempt.sessionId)?.startedAt ?? null;
    const bucket = sessionStartedAt ? findBucket(buckets, sessionStartedAt) : null;
    if (bucket) {
      bucket.attemptCount += 1;
    }
  }

  for (const set of completedStrengthSets) {
    if (options.activityType === "climb" || !matchesEffortFilter(set.effort ?? null, options.effortFilter)) {
      continue;
    }
    const sessionStartedAt = sessionById.get(set.sessionId)?.startedAt ?? null;
    const bucket = sessionStartedAt ? findBucket(buckets, sessionStartedAt) : null;
    if (bucket) {
      bucket.strengthSetCount += 1;
    }
  }

  const reviewValues = new Map<string, { rpe: number[]; performance: number[] }>();
  for (const session of sessions) {
    const bucket = findBucket(buckets, session.startedAt);
    if (!bucket) {
      continue;
    }
    const values = reviewValues.get(bucket.key) ?? { rpe: [], performance: [] };
    if (session.sessionRpe !== null && session.sessionRpe !== undefined) {
      values.rpe.push(session.sessionRpe);
    }
    if (session.performance !== null && session.performance !== undefined) {
      values.performance.push(session.performance);
    }
    reviewValues.set(bucket.key, values);
  }

  for (const bucket of buckets) {
    const values = reviewValues.get(bucket.key);
    bucket.sessionRpeAverage = values ? average(values.rpe) : null;
    bucket.performanceAverage = values ? average(values.performance) : null;
  }

  return {
    period: options.period,
    unit,
    range,
    buckets,
    totalAttempts: buckets.reduce((total, bucket) => total + bucket.attemptCount, 0),
    totalStrengthSets: buckets.reduce((total, bucket) => total + bucket.strengthSetCount, 0),
    hasRecordsInRange: buckets.some((bucket) => bucket.attemptCount > 0 || bucket.strengthSetCount > 0),
  };
}

export function getBucketUnit(period: StatsPeriod): StatsBucketUnit {
  if (period === "7d" || period === "30d") {
    return "day";
  }
  if (period === "all") {
    return "month";
  }
  return "week";
}

export function matchesEffortFilter(effort: number | null | undefined, filter: StatsEffortFilter): boolean {
  const threshold = getEffortFilterThreshold(filter);
  if (threshold === null) {
    return true;
  }
  if (effort === null || effort === undefined) {
    return false;
  }

  if (filter.operator === "=") {
    return effort === threshold;
  }
  if (filter.operator === ">=") {
    return effort >= threshold;
  }
  return effort <= threshold;
}

export function getBucketCenterX(index: number, marginLeft: number, barSlot: number): number {
  return marginLeft + index * barSlot + barSlot / 2;
}

export function buildOverlaySegments(
  buckets: StatsBucket[],
  key: StatsOverlayMetricKey,
  maxValue: number,
  layout: { marginLeft: number; marginTop: number; plotHeight: number; barSlot: number },
): StatsOverlaySegment[] {
  const segments: StatsOverlaySegment[] = [];
  let currentPoints: StatsOverlayPoint[] = [];

  buckets.forEach((bucket, index) => {
    const value = bucket[key];
    if (value === null) {
      if (currentPoints.length > 0) {
        segments.push({ points: currentPoints });
        currentPoints = [];
      }
      return;
    }

    currentPoints.push({
      key: bucket.key,
      label: bucket.label,
      value,
      x: getBucketCenterX(index, layout.marginLeft, layout.barSlot),
      y: layout.marginTop + layout.plotHeight - (value / maxValue) * layout.plotHeight,
    });
  });

  if (currentPoints.length > 0) {
    segments.push({ points: currentPoints });
  }

  return segments;
}

function getEffortFilterThreshold(filter: StatsEffortFilter): EffortRating | null {
  if (filter.value === "all" || filter.label === "all") {
    return null;
  }
  if (filter.value !== undefined) {
    return filter.value;
  }
  if (filter.label !== undefined) {
    return effortFilterThresholds[filter.label];
  }
  return null;
}

export function getStatsRange(
  period: StatsPeriod,
  anchorDate: Date,
  sessions: Session[],
  attempts: Attempt[],
  strengthSets: StrengthSet[],
): { start: Date; end: Date } {
  const anchorDay = startOfLocalDay(anchorDate);
  const end = addDays(anchorDay, 1);

  if (period === "7d") {
    return { start: addDays(anchorDay, -6), end };
  }
  if (period === "30d") {
    return { start: addDays(anchorDay, -29), end };
  }
  if (period === "6m") {
    return { start: startOfWeek(addMonths(anchorDay, -6)), end };
  }
  if (period === "1y") {
    return { start: startOfWeek(addMonths(anchorDay, -12)), end };
  }

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const activityDates = [
    ...sessions.map((session) => session.startedAt),
    ...attempts.map((attempt) => sessionById.get(attempt.sessionId)?.startedAt).filter((value): value is string => value !== undefined),
    ...strengthSets.map((set) => sessionById.get(set.sessionId)?.startedAt).filter((value): value is string => value !== undefined),
  ];
  if (activityDates.length === 0) {
    return { start: startOfMonth(anchorDay), end: addMonths(startOfMonth(anchorDay), 1) };
  }

  const timestamps = activityDates.map((value) => new Date(value).getTime()).filter(Number.isFinite);
  const first = new Date(Math.min(...timestamps));
  const latest = new Date(Math.max(...timestamps, anchorDay.getTime()));
  return { start: startOfMonth(first), end: addMonths(startOfMonth(latest), 1) };
}

function createBuckets(range: { start: Date; end: Date }, unit: StatsBucketUnit): StatsBucket[] {
  const buckets: StatsBucket[] = [];
  let cursor = new Date(range.start);

  while (cursor.getTime() < range.end.getTime()) {
    const start = new Date(cursor);
    const end = unit === "day" ? addDays(start, 1) : unit === "week" ? addDays(start, 7) : addMonths(start, 1);
    buckets.push({
      key: formatBucketKey(start, unit),
      label: formatBucketLabel(start, unit),
      start,
      end,
      attemptCount: 0,
      strengthSetCount: 0,
      sessionRpeAverage: null,
      performanceAverage: null,
    });
    cursor = end;
  }

  return buckets;
}

function findBucket(buckets: StatsBucket[], value: string): StatsBucket | null {
  const time = new Date(value).getTime();
  return buckets.find((bucket) => time >= bucket.start.getTime() && time < bucket.end.getTime()) ?? null;
}

function formatBucketKey(date: Date, unit: StatsBucketUnit): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return unit === "month" ? `${year}-${month}` : `${year}-${month}-${day}`;
}

function formatBucketLabel(date: Date, unit: StatsBucketUnit): string {
  if (unit === "month") {
    return `${date.getFullYear()}/${date.getMonth() + 1}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}
