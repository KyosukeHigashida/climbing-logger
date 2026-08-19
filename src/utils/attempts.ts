import type { Attempt, Climb } from "../types/domain";

export function getAttemptStartTime(attempt: Attempt): string | null {
  return attempt.startedAt;
}

export function getAttemptEndTime(attempt: Attempt): string | null {
  return attempt.endedAt ?? attempt.timestamp ?? null;
}

export function getAttemptSortTime(attempt: Attempt): string {
  return getAttemptStartTime(attempt) ?? getAttemptEndTime(attempt) ?? attempt.createdAt;
}

export function isActiveAttempt(attempt: Attempt): boolean {
  return attempt.startedAt !== null && attempt.endedAt === null;
}

export function isCompletedAttempt(attempt: Attempt): boolean {
  return getAttemptEndTime(attempt) !== null && attempt.result !== null;
}

export function sortAttemptsByTimestamp(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => new Date(getAttemptSortTime(a)).getTime() - new Date(getAttemptSortTime(b)).getTime());
}

export function sortAttemptsByTimestampDesc(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => new Date(getAttemptSortTime(b)).getTime() - new Date(getAttemptSortTime(a)).getTime());
}

export function getPreviousSessionAttempt(attempts: Attempt[], attempt: Attempt): Attempt | null {
  const sortedAttempts = sortAttemptsByTimestamp(attempts);
  const attemptIndex = sortedAttempts.findIndex((item) => item.id === attempt.id);
  return attemptIndex > 0 ? sortedAttempts[attemptIndex - 1] : null;
}

export function getPreviousClimbAttempt(attempts: Attempt[], attempt: Attempt): Attempt | null {
  const sortedAttempts = sortAttemptsByTimestamp(attempts).filter((item) => item.climbId === attempt.climbId);
  const attemptIndex = sortedAttempts.findIndex((item) => item.id === attempt.id);
  return attemptIndex > 0 ? sortedAttempts[attemptIndex - 1] : null;
}

export function getSessionAttemptInterval(attempts: Attempt[], attempt: Attempt): number | null {
  const previous = getPreviousSessionAttempt(attempts, attempt);
  const previousEndedAt = previous ? getAttemptEndTime(previous) : null;
  const startedAt = getAttemptStartTime(attempt);
  return previousEndedAt && startedAt ? new Date(startedAt).getTime() - new Date(previousEndedAt).getTime() : null;
}

export function getClimbAttemptInterval(attempts: Attempt[], attempt: Attempt): number | null {
  const previous = getPreviousClimbAttempt(attempts, attempt);
  const previousEndedAt = previous ? getAttemptEndTime(previous) : null;
  const startedAt = getAttemptStartTime(attempt);
  return previousEndedAt && startedAt ? new Date(startedAt).getTime() - new Date(previousEndedAt).getTime() : null;
}

export function getAttemptCount(attempts: Attempt[], climbId?: string): number {
  const completedAttempts = attempts.filter(isCompletedAttempt);
  return climbId
    ? completedAttempts.filter((attempt) => attempt.climbId === climbId).length
    : completedAttempts.length;
}

export function getAttemptCountsByClimb(attempts: Attempt[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const attempt of attempts.filter(isCompletedAttempt)) {
    counts.set(attempt.climbId, (counts.get(attempt.climbId) ?? 0) + 1);
  }
  return counts;
}

export function getSendCount(attempts: Attempt[]): number {
  return attempts.filter((attempt) => attempt.result === "send").length;
}

export function getFailCount(attempts: Attempt[]): number {
  return attempts.filter((attempt) => attempt.result === "fail").length;
}

export function isFlash(climb: Climb, attempts: Attempt[]): boolean {
  const firstAttempt = sortAttemptsByTimestamp(attempts).find((attempt) => attempt.climbId === climb.id && isCompletedAttempt(attempt));
  return firstAttempt?.result === "send";
}

export function getSessionAttemptIntervals(attempts: Attempt[]): Map<string, number | null> {
  const intervals = new Map<string, number | null>();
  const sortedAttempts = sortAttemptsByTimestamp(attempts);

  sortedAttempts.forEach((attempt, index) => {
    const previous = sortedAttempts[index - 1];
    const previousEndedAt = previous ? getAttemptEndTime(previous) : null;
    const startedAt = getAttemptStartTime(attempt);
    intervals.set(
      attempt.id,
      previousEndedAt && startedAt ? new Date(startedAt).getTime() - new Date(previousEndedAt).getTime() : null,
    );
  });

  return intervals;
}
