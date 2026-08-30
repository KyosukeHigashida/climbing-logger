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

export type SessionGradeTimelineWall =
  | { type: "gym" }
  | { type: "board"; boardId: string };

export function buildSessionGradeTimeline(
  session: Session,
  climbs: Climb[],
  attempts: Attempt[],
  grades: Grade[],
  wall: SessionGradeTimelineWall = { type: "gym" },
): SessionGradeTimeline {
  const climbById = new Map(climbs.map((climb) => [climb.id, climb]));
  const gradeById = new Map(grades.map((grade) => [grade.id, grade]));
  const gradeByOwnerAndLabel = buildGradeByOwnerAndLabel(grades);
  const timelineGymIds = getTimelineGymIds(session, climbs);
  const sessionStartedMs = new Date(session.startedAt).getTime();
  const sessionEndedMs = session.endedAt ? new Date(session.endedAt).getTime() : sessionStartedMs;

  const timelineAttempts = sortAttemptsByTimestamp(attempts)
    .filter(isCompletedAttempt)
    .flatMap((attempt): SessionGradeTimelineAttempt[] => {
      const climb = climbById.get(attempt.climbId);
      if (!climb || !isClimbOnSelectedWall(climb, wall)) {
        return [];
      }

      const resolvedGrade = resolveHistoricalGrade(climb, gradeById, gradeByOwnerAndLabel, wall);
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
    if (isGradeOnSelectedWall(grade, wall, timelineGymIds)) {
      axisGradeById.set(grade.id, grade);
    }
  }
  for (const attempt of timelineAttempts) {
    const historicalGrade = gradeById.get(attempt.gradeId);
    if (historicalGrade && isGradeForWallType(historicalGrade, wall)) {
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
  gradeByOwnerAndLabel: Map<string, Grade>,
  wall: SessionGradeTimelineWall,
): Grade | null {
  if (climb.gradeId) {
    const grade = gradeById.get(climb.gradeId);
    return grade && isGradeForWallType(grade, wall) ? grade : null;
  }

  const label = climb.grade.trim();
  if (!label || label === "Ungraded") {
    return null;
  }

  const ownerKey = getClimbGradeOwnerKey(climb, wall);
  return ownerKey ? gradeByOwnerAndLabel.get(getGradeLabelKey(ownerKey, label)) ?? null : null;
}

function buildGradeByOwnerAndLabel(grades: Grade[]): Map<string, Grade> {
  const matches = new Map<string, Grade[]>();
  for (const grade of grades) {
    const ownerKey = getGradeOwnerKey(grade);
    if (!ownerKey) {
      continue;
    }
    const key = getGradeLabelKey(ownerKey, grade.label);
    matches.set(key, [...(matches.get(key) ?? []), grade]);
  }

  return new Map(
    [...matches.entries()]
      .filter(([, ownerGrades]) => ownerGrades.length === 1)
      .map(([key, ownerGrades]) => [key, ownerGrades[0]]),
  );
}

function getGradeLabelKey(ownerKey: string, label: string): string {
  return `${ownerKey}\u001f${label.trim()}`;
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

function isClimbOnSelectedWall(climb: Climb, wall: SessionGradeTimelineWall): boolean {
  if (wall.type === "board") {
    return climb.wallType === "board" && climb.wallBoardId === wall.boardId;
  }
  return climb.wallType !== "board";
}

function isGradeOnSelectedWall(grade: Grade, wall: SessionGradeTimelineWall, timelineGymIds: Set<string>): boolean {
  if (wall.type === "board") {
    return grade.boardId === wall.boardId && !grade.gymId;
  }
  return !!grade.gymId && !grade.boardId && timelineGymIds.has(grade.gymId);
}

function isGradeForWallType(grade: Grade, wall: SessionGradeTimelineWall): boolean {
  if (wall.type === "board") {
    return grade.boardId === wall.boardId && !grade.gymId;
  }
  return !!grade.gymId && !grade.boardId;
}

function getClimbGradeOwnerKey(climb: Climb, wall: SessionGradeTimelineWall): string | null {
  if (wall.type === "board") {
    return climb.wallBoardId ? `board:${climb.wallBoardId}` : null;
  }
  return climb.gymId ? `gym:${climb.gymId}` : null;
}

function getGradeOwnerKey(grade: Grade): string | null {
  if (grade.boardId && !grade.gymId) {
    return `board:${grade.boardId}`;
  }
  if (grade.gymId && !grade.boardId) {
    return `gym:${grade.gymId}`;
  }
  return null;
}
