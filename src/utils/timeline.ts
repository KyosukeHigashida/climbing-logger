import type { Attempt } from "../types/domain";
import { getAttemptEndTime, getAttemptStartTime, isCompletedAttempt, sortAttemptsByTimestamp } from "./attempts";

export type AttemptTimelineItem = {
  type: "attempt";
  attempt: Attempt;
  startedAt: string | null;
  endedAt: string | null;
  actionDurationMs: number | null;
};

export type RestTimelineItem = {
  type: "rest";
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  previousAttemptId: string;
  nextAttemptId: string;
};

export type TimelineItem = AttemptTimelineItem | RestTimelineItem;

export function getActionDurationMs(attempt: Attempt): number | null {
  const startedAt = getAttemptStartTime(attempt);
  const endedAt = getAttemptEndTime(attempt);
  if (!startedAt || !endedAt) {
    return null;
  }
  return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
}

export function buildSessionTimeline(attempts: Attempt[]): TimelineItem[] {
  const completedAttempts = sortAttemptsByTimestamp(attempts).filter(isCompletedAttempt);
  const items: TimelineItem[] = [];

  completedAttempts.forEach((attempt, index) => {
    const startedAt = getAttemptStartTime(attempt);
    const endedAt = getAttemptEndTime(attempt);
    items.push({
      type: "attempt",
      attempt,
      startedAt,
      endedAt,
      actionDurationMs: getActionDurationMs(attempt),
    });

    const nextAttempt = completedAttempts[index + 1];
    const nextStartedAt = nextAttempt ? getAttemptStartTime(nextAttempt) : null;
    if (endedAt && nextAttempt && nextStartedAt) {
      const durationMs = new Date(nextStartedAt).getTime() - new Date(endedAt).getTime();
      if (durationMs >= 0) {
        items.push({
          type: "rest",
          id: `${attempt.id}:${nextAttempt.id}`,
          startedAt: endedAt,
          endedAt: nextStartedAt,
          durationMs,
          previousAttemptId: attempt.id,
          nextAttemptId: nextAttempt.id,
        });
      }
    }
  });

  return items;
}
