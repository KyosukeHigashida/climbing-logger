import type { Attempt, Climb } from "../types/domain";

export function sortAttemptsByTimestamp(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function sortAttemptsByTimestampDesc(attempts: Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
  return previous ? new Date(attempt.timestamp).getTime() - new Date(previous.timestamp).getTime() : null;
}

export function getClimbAttemptInterval(attempts: Attempt[], attempt: Attempt): number | null {
  const previous = getPreviousClimbAttempt(attempts, attempt);
  return previous ? new Date(attempt.timestamp).getTime() - new Date(previous.timestamp).getTime() : null;
}

export function getAttemptCount(attempts: Attempt[], climbId?: string): number {
  return climbId ? attempts.filter((attempt) => attempt.climbId === climbId).length : attempts.length;
}

export function getAttemptCountsByClimb(attempts: Attempt[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const attempt of attempts) {
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
  const firstAttempt = sortAttemptsByTimestamp(attempts).find((attempt) => attempt.climbId === climb.id);
  return firstAttempt?.result === "send";
}

export function getSessionAttemptIntervals(attempts: Attempt[]): Map<string, number | null> {
  const intervals = new Map<string, number | null>();
  const sortedAttempts = sortAttemptsByTimestamp(attempts);

  sortedAttempts.forEach((attempt, index) => {
    const previous = sortedAttempts[index - 1];
    intervals.set(
      attempt.id,
      previous ? new Date(attempt.timestamp).getTime() - new Date(previous.timestamp).getTime() : null,
    );
  });

  return intervals;
}
