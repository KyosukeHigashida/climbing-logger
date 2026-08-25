import type { Attempt, StrengthSet } from "../types/domain";
import { getAttemptEndTime, getAttemptStartTime, isCompletedAttempt } from "./attempts";

type PhysicalAction = {
  id: string;
  type: "attempt" | "strength";
  startedAt: string;
  endedAt: string;
};

export function getStrengthSetNumbers(strengthSets: StrengthSet[]): Map<string, number> {
  const numbers = new Map<string, number>();
  const countsByName = new Map<string, number>();

  for (const set of sortStrengthSetsByStart(strengthSets).filter((strengthSet) => strengthSet.endedAt !== null)) {
    const nameKey = getStrengthSetNameKey(set.name);
    const nextCount = (countsByName.get(nameKey) ?? 0) + 1;
    countsByName.set(nameKey, nextCount);
    numbers.set(set.id, nextCount);
  }

  return numbers;
}

export function getStrengthSetIntervals(attempts: Attempt[], strengthSets: StrengthSet[]): Map<string, number | null> {
  const intervals = new Map<string, number | null>();
  const actions = buildPhysicalActions(attempts, strengthSets);

  for (const set of sortStrengthSetsByStart(strengthSets)) {
    const startedAtMs = new Date(set.startedAt).getTime();
    const previous = [...actions]
      .filter((action) => action.id !== set.id && new Date(action.endedAt).getTime() <= startedAtMs)
      .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())[0];

    if (!previous) {
      intervals.set(set.id, null);
      continue;
    }

    const intervalMs = startedAtMs - new Date(previous.endedAt).getTime();
    intervals.set(set.id, intervalMs >= 0 ? intervalMs : null);
  }

  return intervals;
}

function buildPhysicalActions(attempts: Attempt[], strengthSets: StrengthSet[]): PhysicalAction[] {
  const attemptActions: PhysicalAction[] = attempts.filter(isCompletedAttempt).flatMap((attempt) => {
    const endedAt = getAttemptEndTime(attempt);
    const startedAt = getAttemptStartTime(attempt) ?? endedAt;
    return startedAt && endedAt ? [{ id: attempt.id, type: "attempt" as const, startedAt, endedAt }] : [];
  });
  const strengthActions: PhysicalAction[] = strengthSets.flatMap((set) =>
    set.endedAt ? [{ id: set.id, type: "strength" as const, startedAt: set.startedAt, endedAt: set.endedAt }] : [],
  );
  return [...attemptActions, ...strengthActions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
}

function sortStrengthSetsByStart(strengthSets: StrengthSet[]): StrengthSet[] {
  return [...strengthSets].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

function getStrengthSetNameKey(name: string): string {
  return name.trim();
}
