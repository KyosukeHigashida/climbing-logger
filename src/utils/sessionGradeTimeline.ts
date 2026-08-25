import type { Attempt, AttemptEffort, AttemptResult, Climb, Grade, Session } from "../types/domain";
import { getAttemptEndTime, getAttemptStartTime, isCompletedAttempt, sortAttemptsByTimestamp } from "./attempts";

export type SessionGradeTimelineAttempt = {
  attemptId: string;
  elapsedMs: number;
  gradeLabel: string;
  gradeId: string;
  gradeOrder: number;
  result: AttemptResult;
  effort?: AttemptEffort;
  climbName: string | null;
  wallAngle: number | null;
};

export type SessionGradeTimeline = {
  attempts: SessionGradeTimelineAttempt[];
  grades: Array<{
    id: string;
    label: string;
    order: number;
  }>;
  durationMs: number;
};

export function buildSessionGradeTimeline(
  session: Session,
  climbs: Climb[],
  attempts: Attempt[],
  grades: Grade[],
): SessionGradeTimeline {
  const climbById = new Map(climbs.map((climb) => [climb.id, climb]));
  const gradeById = new Map(grades.map((grade) => [grade.id, grade]));
  const gradeByGymAndLabel = buildGradeByGymAndLabel(grades);
  const timelineGymIds = getTimelineGymIds(session, climbs);
  const sessionStartedMs = new Date(session.startedAt).getTime();
  const sessionEndedMs = session.endedAt ? new Date(session.endedAt).getTime() : sessionStartedMs;

  const timelineAttempts = sortAttemptsByTimestamp(attempts)
    .filter(isCompletedAttempt)
    .flatMap((attempt): SessionGradeTimelineAttempt[] => {
      const climb = climbById.get(attempt.climbId);
      if (!climb || climb.wallType === "board") {
        return [];
      }

      const resolvedGrade = resolveHistoricalGrade(climb, gradeById, gradeByGymAndLabel);
      if (!resolvedGrade || !attempt.result) {
        return [];
      }

      const attemptTime = getAttemptStartTime(attempt) ?? getAttemptEndTime(attempt);
      if (!attemptTime) {
        return [];
      }

      return [
        {
          attemptId: attempt.id,
          elapsedMs: Math.max(0, new Date(attemptTime).getTime() - sessionStartedMs),
          gradeLabel: resolvedGrade.label,
          gradeId: resolvedGrade.id,
          gradeOrder: resolvedGrade.order,
          result: attempt.result,
          effort: attempt.effort,
          climbName: climb.name ?? null,
          wallAngle: climb.wallAngle ?? null,
        },
      ];
    });

  const axisGradeById = new Map<string, Grade>();
  for (const grade of grades) {
    if (isGymGradeForTimeline(grade) && grade.gymId && timelineGymIds.has(grade.gymId)) {
      axisGradeById.set(grade.id, grade);
    }
  }
  for (const attempt of timelineAttempts) {
    const historicalGrade = gradeById.get(attempt.gradeId);
    if (historicalGrade && isGymGradeForTimeline(historicalGrade)) {
      axisGradeById.set(historicalGrade.id, historicalGrade);
    }
  }

  const axisGrades = [...axisGradeById.values()]
    .sort((a, b) => a.order - b.order)
    .map((grade) => ({ id: grade.id, label: grade.label, order: grade.order }));
  const latestAttemptMs = Math.max(0, ...timelineAttempts.map((attempt) => attempt.elapsedMs));

  return {
    attempts: timelineAttempts,
    grades: axisGrades,
    durationMs: Math.max(0, sessionEndedMs - sessionStartedMs, latestAttemptMs),
  };
}

export function getGradeLevelRatio(gradeIndex: number, gradeCount: number): number {
  if (gradeCount <= 0) {
    return 0;
  }
  return (Math.max(0, gradeIndex) + 1) / gradeCount;
}

function resolveHistoricalGrade(
  climb: Climb,
  gradeById: Map<string, Grade>,
  gradeByGymAndLabel: Map<string, Grade>,
): Grade | null {
  if (climb.gradeId) {
    const grade = gradeById.get(climb.gradeId);
    return grade && isGymGradeForTimeline(grade) ? grade : null;
  }

  const gymId = climb.gymId ?? null;
  const label = climb.grade.trim();
  if (!gymId || !label || label === "Ungraded") {
    return null;
  }

  return gradeByGymAndLabel.get(getGymGradeLabelKey(gymId, label)) ?? null;
}

function buildGradeByGymAndLabel(grades: Grade[]): Map<string, Grade> {
  const matches = new Map<string, Grade[]>();
  for (const grade of grades) {
    if (!isGymGradeForTimeline(grade) || !grade.gymId) {
      continue;
    }
    const key = getGymGradeLabelKey(grade.gymId, grade.label);
    matches.set(key, [...(matches.get(key) ?? []), grade]);
  }

  return new Map(
    [...matches.entries()]
      .filter(([, ownerGrades]) => ownerGrades.length === 1)
      .map(([key, ownerGrades]) => [key, ownerGrades[0]]),
  );
}

function getGymGradeLabelKey(gymId: string, label: string): string {
  return `${gymId}\u001f${label.trim()}`;
}

function getTimelineGymIds(session: Session, climbs: Climb[]): Set<string> {
  const gymIds = new Set<string>();
  if (session.initialGymId) {
    gymIds.add(session.initialGymId);
    return gymIds;
  }

  for (const climb of climbs) {
    if (climb.wallType !== "board" && climb.gymId) {
      gymIds.add(climb.gymId);
    }
  }
  return gymIds;
}

function isGymGradeForTimeline(grade: Grade): boolean {
  return !!grade.gymId && !grade.boardId;
}
