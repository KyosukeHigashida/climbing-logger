import type { Attempt, Climb, StrengthSet } from "../types/domain";
import { getAttemptEndTime, getAttemptStartTime } from "./attempts";

export type RecentActivityFilter = "activity" | "climbs" | "training";

export type RecentActivityItem =
  | {
      type: "climb";
      climb: Climb;
      attempts: Attempt[];
      sortTime: string;
    }
  | {
      type: "training";
      set: StrengthSet;
      sets: StrengthSet[];
      name: string;
      sortTime: string;
    };

export function buildRecentActivity(
  climbs: Climb[],
  attempts: Attempt[],
  strengthSets: StrengthSet[],
  filter: RecentActivityFilter = "activity",
): RecentActivityItem[] {
  const attemptsByClimb = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    attemptsByClimb.set(attempt.climbId, [...(attemptsByClimb.get(attempt.climbId) ?? []), attempt]);
  }

  const climbItems: RecentActivityItem[] =
    filter === "training"
      ? []
      : climbs.map((climb) => {
          const climbAttempts = attemptsByClimb.get(climb.id) ?? [];
          return {
            type: "climb" as const,
            climb,
            attempts: climbAttempts,
            sortTime: getLatestAttemptTime(climbAttempts) ?? climb.createdAt,
          };
        });

  const trainingItems: RecentActivityItem[] =
    filter === "climbs"
      ? []
      : buildTrainingItems(strengthSets);

  return [...climbItems, ...trainingItems].sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime());
}

function buildTrainingItems(strengthSets: StrengthSet[]): RecentActivityItem[] {
  const setsByIdentity = new Map<string, StrengthSet[]>();
  for (const set of strengthSets) {
    const identity = getStrengthSetCardKey(set);
    setsByIdentity.set(identity, [...(setsByIdentity.get(identity) ?? []), set]);
  }

  return [...setsByIdentity.values()].flatMap((sets) => {
    const sortedSets = [...sets].sort((a, b) => new Date(getStrengthSetSortTime(b)).getTime() - new Date(getStrengthSetSortTime(a)).getTime());
    const latestSet = sortedSets[0];
    if (!latestSet) {
      return [];
    }
    return [
      {
        type: "training" as const,
        set: latestSet,
        sets: sortedSets,
        name: getStrengthNameKey(latestSet.name),
        sortTime: getStrengthSetSortTime(latestSet),
      },
    ];
  });
}

export function getLatestStrengthSetByName(strengthSets: StrengthSet[], name: string): StrengthSet | null {
  const nameKey = getStrengthNameKey(name);
  return [...strengthSets]
    .filter((set) => getStrengthNameKey(set.name) === nameKey)
    .sort((a, b) => new Date(getStrengthSetSortTime(b)).getTime() - new Date(getStrengthSetSortTime(a)).getTime())[0] ?? null;
}

export function getStrengthSetCardKey(set: Pick<StrengthSet, "name" | "weight" | "reps" | "workDurationSeconds">): string {
  return [
    getStrengthNameKey(set.name),
    normalizeNullableNumber(set.weight),
    normalizeNullableNumber(set.reps),
    normalizeNullableNumber(set.workDurationSeconds),
  ].join("\u001f");
}

export function getStrengthNameSuggestions(strengthSets: StrengthSet[]): string[] {
  const seen = new Set<string>();
  return [...strengthSets]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .map((set) => set.name.trim())
    .filter((name) => {
      if (!name || seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    });
}

function getLatestAttemptTime(attempts: Attempt[]): string | null {
  const sortedTimes = attempts
    .map((attempt) => getAttemptEndTime(attempt) ?? getAttemptStartTime(attempt) ?? attempt.createdAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return sortedTimes[0] ?? null;
}

function getStrengthSetSortTime(set: StrengthSet): string {
  return set.endedAt ?? set.startedAt;
}

function getStrengthNameKey(name: string): string {
  return name.trim() || "Untitled training";
}

function normalizeNullableNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
