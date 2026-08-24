import type { Attempt, Session, StrengthSet } from "../types/domain";

export type DateRange = {
  start: Date;
  end: Date;
};

export type PeriodSummary = {
  sessionCount: number;
  activeDays: number;
  attemptCount: number;
  sendCount: number;
  strengthSetCount: number;
  averageSessionRpe: number | null;
  averagePerformance: number | null;
  totalDurationMs: number | null;
};

export type DayActivity = {
  dateKey: string;
  sessionCount: number;
  hasClimbing: boolean;
  hasTraining: boolean;
};

export function getTodayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getMonthRange(date: Date): DateRange {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  };
}

export function getWeekRange(date: Date): DateRange {
  const start = startOfLocalDay(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

export function getCalendarDates(monthDate: Date): Date[] {
  const monthStart = getMonthRange(monthDate).start;
  const firstGridDate = new Date(monthStart);
  firstGridDate.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate);
    date.setDate(firstGridDate.getDate() + index);
    return date;
  });
}

export function toDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

export function formatSelectedDateTitle(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(dateFromKey(dateKey));
}

export function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getSessionsForDate(sessions: Session[], dateKey: string): Session[] {
  return sessions
    .filter((session) => toDateKey(session.startedAt) === dateKey)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

export function buildDayActivities(
  sessions: Session[],
  attempts: Attempt[],
  strengthSets: StrengthSet[],
  range: DateRange,
): Map<string, DayActivity> {
  const sessionsInRange = getSessionsInRange(sessions, range);
  const sessionIdsByDate = new Map<string, Set<string>>();

  sessionsInRange.forEach((session) => {
    const dateKey = toDateKey(session.startedAt);
    const ids = sessionIdsByDate.get(dateKey) ?? new Set<string>();
    ids.add(session.id);
    sessionIdsByDate.set(dateKey, ids);
  });

  const activities = new Map<string, DayActivity>();
  sessionIdsByDate.forEach((sessionIds, dateKey) => {
    activities.set(dateKey, {
      dateKey,
      sessionCount: sessionIds.size,
      hasClimbing: attempts.some((attempt) => sessionIds.has(attempt.sessionId)),
      hasTraining: strengthSets.some((set) => sessionIds.has(set.sessionId)),
    });
  });
  return activities;
}

export function buildPeriodSummary(
  sessions: Session[],
  attempts: Attempt[],
  strengthSets: StrengthSet[],
  range: DateRange,
): PeriodSummary {
  const sessionsInRange = getSessionsInRange(sessions, range);
  const sessionIds = new Set(sessionsInRange.map((session) => session.id));
  const periodAttempts = attempts.filter((attempt) => sessionIds.has(attempt.sessionId));
  const periodStrengthSets = strengthSets.filter((set) => sessionIds.has(set.sessionId));
  const activeDays = new Set(sessionsInRange.map((session) => toDateKey(session.startedAt))).size;
  const sessionRpes = sessionsInRange
    .map((session) => session.sessionRpe)
    .filter((value): value is number => value !== null && value !== undefined);
  const performances = sessionsInRange
    .map((session) => session.performance)
    .filter((value): value is number => value !== null && value !== undefined);
  const durations = sessionsInRange
    .map((session) => (session.endedAt ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime() : null))
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);

  return {
    sessionCount: sessionsInRange.length,
    activeDays,
    attemptCount: periodAttempts.length,
    sendCount: periodAttempts.filter((attempt) => attempt.result === "send").length,
    strengthSetCount: periodStrengthSets.length,
    averageSessionRpe: average(sessionRpes),
    averagePerformance: average(performances),
    totalDurationMs: durations.length > 0 ? durations.reduce((total, duration) => total + duration, 0) : null,
  };
}

export function getSessionsInRange(sessions: Session[], range: DateRange): Session[] {
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  return sessions.filter((session) => {
    const startedAt = new Date(session.startedAt).getTime();
    return startedAt >= startMs && startedAt < endMs;
  });
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}
