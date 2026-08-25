import type { Attempt, StrengthSet } from "../types/domain";
import { getAttemptEndTime, getAttemptStartTime, isCompletedAttempt } from "./attempts";

type PhysicalAction = {
  id: string;
  type: "attempt" | "strength";
  startedAt: string;
  endedAt: string;
};

export type StrengthSetIdentity = Pick<StrengthSet, "name" | "weight" | "reps" | "workDurationSeconds">;

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

export function getCompletedStrengthSetCountForIdentity(strengthSets: StrengthSet[], identity: StrengthSetIdentity | null): number {
  if (!identity) {
    return 0;
  }

  const identityKey = getStrengthSetCardKey(identity);
  return strengthSets.filter((set) => set.endedAt !== null && getStrengthSetCardKey(set) === identityKey).length;
}

export function getLatestStrengthSetByName(strengthSets: StrengthSet[], name: string): StrengthSet | null {
  const nameKey = getStrengthSetNameKey(name);
  return [...strengthSets]
    .filter((set) => getStrengthSetNameKey(set.name) === nameKey)
    .sort((a, b) => new Date(getStrengthSetSortTime(b)).getTime() - new Date(getStrengthSetSortTime(a)).getTime())[0] ?? null;
}

export function getStrengthSetCardKey(set: StrengthSetIdentity): string {
  return [
    getStrengthSetNameKey(set.name) || "Untitled training",
    normalizeNullableNumber(set.weight),
    normalizeNullableNumber(set.reps),
    normalizeNullableNumber(set.workDurationSeconds),
  ].join("\u001f");
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

export function getLastCompletedPhysicalActivityEnd(attempts: Attempt[], strengthSets: StrengthSet[]): string | null {
  return buildPhysicalActions(attempts, strengthSets).sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())[0]?.endedAt ?? null;
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

function getStrengthSetSortTime(set: StrengthSet): string {
  return set.endedAt ?? set.startedAt;
}

function normalizeNullableNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
