import type { Attempt, StrengthSet } from "../types/domain";
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
  previousActionId: string;
  nextActionId: string;
};

export type StrengthTimelineItem = {
  type: "strength";
  set: StrengthSet;
  startedAt: string;
  endedAt: string;
  actionDurationMs: number;
};

export type TimelineItem = AttemptTimelineItem | StrengthTimelineItem | RestTimelineItem;

export function getActionDurationMs(attempt: Attempt): number | null {
  const startedAt = getAttemptStartTime(attempt);
  const endedAt = getAttemptEndTime(attempt);
  if (!startedAt || !endedAt) {
    return null;
  }
  return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
}

export function buildSessionTimeline(attempts: Attempt[], strengthSets: StrengthSet[] = []): TimelineItem[] {
  const completedAttempts = sortAttemptsByTimestamp(attempts).filter(isCompletedAttempt);
  const completedStrengthSets = strengthSets
    .filter((set) => set.endedAt !== null)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  const actionItems = [
    ...completedAttempts.map((attempt): AttemptTimelineItem => {
      const startedAt = getAttemptStartTime(attempt);
      const endedAt = getAttemptEndTime(attempt);
      return {
        type: "attempt",
        attempt,
        startedAt,
        endedAt,
        actionDurationMs: getActionDurationMs(attempt),
      };
    }),
    ...completedStrengthSets.map((set): StrengthTimelineItem => ({
      type: "strength",
      set,
      startedAt: set.startedAt,
      endedAt: set.endedAt ?? set.startedAt,
      actionDurationMs: Math.max(0, new Date(set.endedAt ?? set.startedAt).getTime() - new Date(set.startedAt).getTime()),
    })),
  ].sort((a, b) => new Date(a.startedAt ?? a.endedAt ?? "").getTime() - new Date(b.startedAt ?? b.endedAt ?? "").getTime());
  const items: TimelineItem[] = [];

  actionItems.forEach((item, index) => {
    items.push(item);
    const endedAt = item.endedAt;
    const nextItem = actionItems[index + 1];
    const nextStartedAt = nextItem?.startedAt ?? null;
    if (endedAt && nextItem && nextStartedAt) {
      const durationMs = new Date(nextStartedAt).getTime() - new Date(endedAt).getTime();
      if (durationMs >= 0) {
        items.push({
          type: "rest",
          id: `${getTimelineActionId(item)}:${getTimelineActionId(nextItem)}`,
          startedAt: endedAt,
          endedAt: nextStartedAt,
          durationMs,
          previousActionId: getTimelineActionId(item),
          nextActionId: getTimelineActionId(nextItem),
        });
      }
    }
  });

  return items;
}

function getTimelineActionId(item: AttemptTimelineItem | StrengthTimelineItem): string {
  return item.type === "attempt" ? item.attempt.id : item.set.id;
}
