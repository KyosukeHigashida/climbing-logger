import { db } from "./db";
import type { Attempt, AttemptEffort, AttemptResult, Board, Climb, EffortRating, Grade, Gym, Session, StrengthSet, WallAngle } from "../types/domain";
import { generateId } from "../utils/id";
import { nowIso } from "../utils/time";

const CURRENT_SCHEMA_VERSION = 12;

export type DataExport = {
  schemaVersion: number;
  exportedAt: string;
  gyms: Gym[];
  boards: Board[];
  grades: Grade[];
  wallAngles: WallAngle[];
  sessions: Session[];
  climbs: Climb[];
  attempts: Attempt[];
  strengthSets: StrengthSet[];
};

export type ActiveSessionSnapshot = {
  session: Session;
  climbs: Climb[];
  attempts: Attempt[];
  strengthSets: StrengthSet[];
  gym: Gym | null;
  gyms: Gym[];
  boards: Board[];
  grades: Grade[];
  wallAngles: WallAngle[];
  ui: {
    currentClimbId: string | null;
    currentWallType: "gym" | "board";
    currentBoardId: string | null;
    currentActivityType: "climb" | "training";
  };
};

export type StrengthSetUpdate = {
  name?: string;
  startedAt?: string;
  endedAt?: string | null;
  weight?: number | null;
  reps?: number | null;
  workDurationSeconds?: number | null;
  effort?: EffortRating | null;
  memo?: string | null;
};

export type AttemptUpdate = {
  result: AttemptResult | null;
  startedAt?: string | null;
  endedAt?: string | null;
  timestamp?: string;
  climbId: string;
  effort?: AttemptEffort | null;
  note?: string | null;
};

export type ClimbUpdate = {
  grade: string;
  name: string | null;
  gymId?: string | null;
  gradeId?: string | null;
  wallAnglePresetId?: string | null;
  wallAngle?: number | null;
  wallType?: "gym" | "board";
  wallBoardId?: string | null;
  wallLabel?: string | null;
  memo?: string | null;
};

export type SessionReviewUpdate = {
  sessionRpe?: number | null;
  performance?: number | null;
  memo?: string | null;
};

export function getAllGyms(): Promise<Gym[]> {
  return db.gyms.orderBy("name").toArray();
}

export function getAllBoards(): Promise<Board[]> {
  return db.boards.orderBy("name").toArray();
}

export function getActiveBoards(): Promise<Board[]> {
  return db.boards.filter((board) => !board.isArchived).sortBy("name");
}

export function getActiveGyms(): Promise<Gym[]> {
  return db.gyms.filter((gym) => !gym.isArchived).sortBy("name");
}

export async function getGym(gymId: string): Promise<Gym | null> {
  return (await db.gyms.get(gymId)) ?? null;
}

export function getAllGrades(): Promise<Grade[]> {
  return db.grades.orderBy("order").toArray();
}

export function getAllWallAngles(): Promise<WallAngle[]> {
  return db.wallAngles.orderBy("order").toArray();
}

export function getGymGrades(gymId: string, includeArchived = false): Promise<Grade[]> {
  return db.grades
    .where("gymId")
    .equals(gymId)
    .filter((grade) => includeArchived || !grade.isArchived)
    .sortBy("order");
}

export function getBoardGrades(boardId: string, includeArchived = false): Promise<Grade[]> {
  return db.grades
    .where("boardId")
    .equals(boardId)
    .filter((grade) => includeArchived || !grade.isArchived)
    .sortBy("order");
}

export function getGymWallAngles(gymId: string, includeArchived = false): Promise<WallAngle[]> {
  return db.wallAngles
    .where("gymId")
    .equals(gymId)
    .filter((wallAngle) => includeArchived || !wallAngle.isArchived)
    .sortBy("order");
}

export function getBoardWallAngles(boardId: string, includeArchived = false): Promise<WallAngle[]> {
  return db.wallAngles
    .where("boardId")
    .equals(boardId)
    .filter((wallAngle) => includeArchived || !wallAngle.isArchived)
    .sortBy("order");
}

export async function createGym(name: string): Promise<Gym> {
  const normalizedName = normalizeRequiredText(name, "Gym name is required.");
  const timestamp = nowIso();
  const gym: Gym = {
    id: generateId(),
    name: normalizedName,
    isArchived: false,
    createdAt: timestamp,
  };

  await db.gyms.add(gym);
  return gym;
}

export async function updateGym(gymId: string, name: string): Promise<void> {
  const gym = await db.gyms.get(gymId);
  if (!gym) {
    throw new Error("Gym does not exist.");
  }

  await db.gyms.update(gymId, {
    name: normalizeRequiredText(name, "Gym name is required."),
    updatedAt: nowIso(),
  });
}

export async function archiveGym(gymId: string, isArchived = true): Promise<void> {
  const gym = await db.gyms.get(gymId);
  if (!gym) {
    throw new Error("Gym does not exist.");
  }

  await db.gyms.update(gymId, { isArchived, updatedAt: nowIso() });
}

export async function deleteGym(gymId: string): Promise<void> {
  const gym = await db.gyms.get(gymId);
  if (!gym) {
    throw new Error("Gym does not exist.");
  }

  const [sessionCount, climbCount] = await Promise.all([
    db.sessions.where("initialGymId").equals(gymId).count(),
    db.climbs.where("gymId").equals(gymId).count(),
  ]);
  if (sessionCount + climbCount > 0) {
    throw new Error("Used gyms can only be archived.");
  }

  await db.transaction("rw", db.gyms, db.grades, db.wallAngles, async () => {
    const grades = await db.grades.where("gymId").equals(gymId).toArray();
    const wallAngles = await db.wallAngles.where("gymId").equals(gymId).toArray();
    await db.grades.bulkDelete(grades.map((grade) => grade.id));
    await db.wallAngles.bulkDelete(wallAngles.map((angle) => angle.id));
    await db.gyms.delete(gymId);
  });
}

export async function createBoard(name: string): Promise<Board> {
  const normalizedName = normalizeRequiredText(name, "Board name is required.");
  const timestamp = nowIso();
  const board: Board = {
    id: generateId(),
    name: normalizedName,
    isArchived: false,
    createdAt: timestamp,
  };

  await db.boards.add(board);
  return board;
}

export async function updateBoard(boardId: string, name: string): Promise<void> {
  const board = await db.boards.get(boardId);
  if (!board) {
    throw new Error("Board does not exist.");
  }

  await db.boards.update(boardId, {
    name: normalizeRequiredText(name, "Board name is required."),
    updatedAt: nowIso(),
  });
}

export async function archiveBoard(boardId: string, isArchived = true): Promise<void> {
  const board = await db.boards.get(boardId);
  if (!board) {
    throw new Error("Board does not exist.");
  }

  await db.boards.update(boardId, { isArchived, updatedAt: nowIso() });
}

export async function deleteBoard(boardId: string): Promise<void> {
  const board = await db.boards.get(boardId);
  if (!board) {
    throw new Error("Board does not exist.");
  }

  const climbCount = await db.climbs.where("wallBoardId").equals(boardId).count();
  if (climbCount > 0) {
    throw new Error("Used boards can only be archived.");
  }

  await db.transaction("rw", db.boards, db.grades, db.wallAngles, async () => {
    const grades = await db.grades.where("boardId").equals(boardId).toArray();
    const wallAngles = await db.wallAngles.where("boardId").equals(boardId).toArray();
    await db.grades.bulkDelete(grades.map((grade) => grade.id));
    await db.wallAngles.bulkDelete(wallAngles.map((angle) => angle.id));
    await db.boards.delete(boardId);
  });
}

export async function createGrade(gymId: string, label: string): Promise<Grade> {
  const gym = await db.gyms.get(gymId);
  if (!gym) {
    throw new Error("Gym does not exist.");
  }

  const existing = await getGymGrades(gymId, true);
  const timestamp = nowIso();
  const grade: Grade = {
    id: generateId(),
    gymId,
    label: normalizeRequiredText(label, "Grade label is required."),
    order: existing.length,
    isArchived: false,
    createdAt: timestamp,
  };

  await db.grades.add(grade);
  return grade;
}

export async function replaceGymGrades(gymId: string, labels: string[]): Promise<Grade[]> {
  const gym = await db.gyms.get(gymId);
  if (!gym) {
    throw new Error("Gym does not exist.");
  }

  return replaceGradeRecords({ type: "gym", id: gymId }, labels);
}

export async function createBoardGrade(boardId: string, label: string): Promise<Grade> {
  const board = await db.boards.get(boardId);
  if (!board) {
    throw new Error("Board does not exist.");
  }

  const existing = await getBoardGrades(boardId, true);
  const timestamp = nowIso();
  const grade: Grade = {
    id: generateId(),
    gymId: null,
    boardId,
    label: normalizeRequiredText(label, "Grade label is required."),
    order: existing.length,
    isArchived: false,
    createdAt: timestamp,
  };

  await db.grades.add(grade);
  return grade;
}

export async function replaceBoardGrades(boardId: string, labels: string[]): Promise<Grade[]> {
  const board = await db.boards.get(boardId);
  if (!board) {
    throw new Error("Board does not exist.");
  }

  return replaceGradeRecords({ type: "board", id: boardId }, labels);
}

export async function updateGrade(gradeId: string, label: string): Promise<Grade> {
  const grade = await db.grades.get(gradeId);
  if (!grade) {
    throw new Error("Grade does not exist.");
  }

  const updatedAt = nowIso();
  const updatedGrade: Grade = {
    ...grade,
    label: normalizeRequiredText(label, "Grade label is required."),
    updatedAt,
  };

  await db.grades.update(gradeId, {
    label: updatedGrade.label,
    updatedAt,
  });
  return updatedGrade;
}

export async function archiveGrade(gradeId: string, isArchived = true): Promise<Grade> {
  const grade = await db.grades.get(gradeId);
  if (!grade) {
    throw new Error("Grade does not exist.");
  }

  const updatedAt = nowIso();
  const updatedGrade: Grade = { ...grade, isArchived, updatedAt };
  await db.grades.update(gradeId, { isArchived, updatedAt });
  return updatedGrade;
}

export async function deleteGrade(gradeId: string): Promise<void> {
  const grade = await db.grades.get(gradeId);
  if (!grade) {
    throw new Error("Grade does not exist.");
  }

  const climbCount = await db.climbs.where("gradeId").equals(gradeId).count();
  if (climbCount > 0) {
    throw new Error("Used grades can only be archived.");
  }

  await db.grades.delete(gradeId);
}

export async function moveGrade(gradeId: string, direction: "up" | "down"): Promise<void> {
  const grade = await db.grades.get(gradeId);
  if (!grade) {
    throw new Error("Grade does not exist.");
  }

  const grades = grade.boardId ? await getBoardGrades(grade.boardId, true) : await getGymGrades(grade.gymId ?? "", true);
  const index = grades.findIndex((item) => item.id === gradeId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= grades.length) {
    return;
  }

  const reordered = [...grades];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved);
  if (grade.boardId) {
    await reorderBoardGrades(grade.boardId, reordered.map((item) => item.id));
  } else {
    await reorderGrades(grade.gymId ?? "", reordered.map((item) => item.id));
  }
}

export async function reorderGrades(gymId: string, orderedGradeIds: string[]): Promise<void> {
  const grades = await getGymGrades(gymId, true);
  await reorderGradeRecords(grades, orderedGradeIds, "Grade order contains a grade from another gym.");
}

export async function reorderBoardGrades(boardId: string, orderedGradeIds: string[]): Promise<void> {
  const grades = await getBoardGrades(boardId, true);
  await reorderGradeRecords(grades, orderedGradeIds, "Grade order contains a grade from another board.");
}

export async function createWallAngle(gymId: string, angle: number): Promise<WallAngle> {
  const gym = await db.gyms.get(gymId);
  if (!gym) {
    throw new Error("Gym does not exist.");
  }

  const existing = await getGymWallAngles(gymId, true);
  const normalizedAngle = validateWallAngleValue(angle);
  const existingAngle = existing.find((wallAngle) => wallAngle.angle === normalizedAngle);
  if (existingAngle) {
    if (existingAngle.isArchived) {
      const update = { isArchived: false, updatedAt: nowIso() };
      await db.wallAngles.update(existingAngle.id, update);
      return { ...existingAngle, ...update };
    }
    return existingAngle;
  }

  const timestamp = nowIso();
  const wallAngle: WallAngle = {
    id: generateId(),
    gymId,
    angle: normalizedAngle,
    order: existing.length,
    isArchived: false,
    createdAt: timestamp,
  };

  await db.wallAngles.add(wallAngle);
  return wallAngle;
}

export async function createBoardWallAngle(boardId: string, angle: number): Promise<WallAngle> {
  const board = await db.boards.get(boardId);
  if (!board) {
    throw new Error("Board does not exist.");
  }

  const existing = await getBoardWallAngles(boardId, true);
  const normalizedAngle = validateWallAngleValue(angle);
  const existingAngle = existing.find((wallAngle) => wallAngle.angle === normalizedAngle);
  if (existingAngle) {
    if (existingAngle.isArchived) {
      const update = { isArchived: false, updatedAt: nowIso() };
      await db.wallAngles.update(existingAngle.id, update);
      return { ...existingAngle, ...update };
    }
    return existingAngle;
  }

  const timestamp = nowIso();
  const wallAngle: WallAngle = {
    id: generateId(),
    gymId: null,
    boardId,
    angle: normalizedAngle,
    order: existing.length,
    isArchived: false,
    createdAt: timestamp,
  };

  await db.wallAngles.add(wallAngle);
  return wallAngle;
}

export async function updateWallAngle(wallAngleId: string, angle: number): Promise<WallAngle> {
  const wallAngle = await db.wallAngles.get(wallAngleId);
  if (!wallAngle) {
    throw new Error("Wall angle does not exist.");
  }

  const updatedAt = nowIso();
  const updatedWallAngle: WallAngle = {
    ...wallAngle,
    angle: validateWallAngleValue(angle),
    isArchived: false,
    updatedAt,
  };
  await db.wallAngles.update(wallAngleId, {
    angle: updatedWallAngle.angle,
    isArchived: false,
    updatedAt,
  });
  return updatedWallAngle;
}

export async function deleteWallAngle(wallAngleId: string): Promise<WallAngle | null> {
  const wallAngle = await db.wallAngles.get(wallAngleId);
  if (!wallAngle) {
    throw new Error("Wall angle does not exist.");
  }

  const climbCount = await db.climbs.where("wallAnglePresetId").equals(wallAngleId).count();
  if (climbCount > 0) {
    const updatedAt = nowIso();
    const archivedWallAngle: WallAngle = { ...wallAngle, isArchived: true, updatedAt };
    await db.wallAngles.update(wallAngleId, { isArchived: true, updatedAt });
    return archivedWallAngle;
  }

  await db.wallAngles.delete(wallAngleId);
  return null;
}

export async function reorderWallAngles(gymId: string, orderedWallAngleIds: string[]): Promise<void> {
  const wallAngles = await getGymWallAngles(gymId);
  await reorderWallAngleRecords(wallAngles, orderedWallAngleIds, "Wall angle order contains an angle from another gym.");
}

export async function reorderBoardWallAngles(boardId: string, orderedWallAngleIds: string[]): Promise<void> {
  const wallAngles = await getBoardWallAngles(boardId);
  await reorderWallAngleRecords(wallAngles, orderedWallAngleIds, "Wall angle order contains an angle from another board.");
}

export async function replaceGymWallAngles(gymId: string, angles: number[]): Promise<WallAngle[]> {
  const gym = await db.gyms.get(gymId);
  if (!gym) {
    throw new Error("Gym does not exist.");
  }

  return replaceWallAngleRecords({ type: "gym", id: gymId }, angles);
}

export async function replaceBoardWallAngles(boardId: string, angles: number[]): Promise<WallAngle[]> {
  const board = await db.boards.get(boardId);
  if (!board) {
    throw new Error("Board does not exist.");
  }

  return replaceWallAngleRecords({ type: "board", id: boardId }, angles);
}

export function getAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy("startedAt").reverse().toArray();
}

export function getAllAttempts(): Promise<Attempt[]> {
  return db.attempts.toArray();
}

export function getAllStrengthSets(): Promise<StrengthSet[]> {
  return db.strengthSets.toArray();
}

export function getAllClimbs(): Promise<Climb[]> {
  return db.climbs.toArray();
}

export async function getActiveSession(): Promise<Session | null> {
  return (await db.sessions.filter((session) => session.endedAt === null).first()) ?? null;
}

export async function loadCurrentActiveSessionSnapshot(
  currentClimbId: string | null = null,
  currentWallType: "gym" | "board" = "gym",
  currentBoardId: string | null = null,
): Promise<ActiveSessionSnapshot | null> {
  const session = await getActiveSession();
  return session ? loadActiveSessionSnapshot(session.id, currentClimbId, currentWallType, currentBoardId) : null;
}

export async function loadActiveSessionSnapshot(
  sessionId: string,
  currentClimbId: string | null = null,
  currentWallType: "gym" | "board" = "gym",
  currentBoardId: string | null = null,
): Promise<ActiveSessionSnapshot | null> {
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  const [climbs, attempts, strengthSets, gyms, boards, grades, wallAngles] = await Promise.all([
    getSessionClimbs(sessionId),
    getSessionAttempts(sessionId),
    getSessionStrengthSets(sessionId),
    getAllGyms(),
    getActiveBoards(),
    getAllGrades(),
    getAllWallAngles(),
  ]);
  const gym = session.initialGymId ? gyms.find((item) => item.id === session.initialGymId) ?? null : null;
  const resolvedCurrentClimbId =
    currentClimbId && climbs.some((climb) => climb.id === currentClimbId)
      ? currentClimbId
      : [...climbs].reverse()[0]?.id ?? null;
  const resolvedCurrentWall =
    currentWallType === "board" && currentBoardId && boards.some((board) => board.id === currentBoardId)
      ? { currentWallType: "board" as const, currentBoardId }
      : { currentWallType: "gym" as const, currentBoardId: null };

  return {
    session,
    climbs,
    attempts,
    gym,
    gyms,
    boards,
    grades,
    wallAngles,
    strengthSets,
    ui: {
      currentClimbId: resolvedCurrentClimbId,
      ...resolvedCurrentWall,
      currentActivityType: "climb",
    },
  };
}

export async function getSession(sessionId: string): Promise<Session | null> {
  return (await db.sessions.get(sessionId)) ?? null;
}

export function getSessionClimbs(sessionId: string): Promise<Climb[]> {
  return db.climbs.where("sessionId").equals(sessionId).sortBy("createdAt");
}

export function getSessionAttempts(sessionId: string): Promise<Attempt[]> {
  return db.attempts
    .where("sessionId")
    .equals(sessionId)
    .toArray((attempts) => attempts.sort((a, b) => getAttemptSortTime(a) - getAttemptSortTime(b)));
}

export function getSessionStrengthSets(sessionId: string): Promise<StrengthSet[]> {
  return db.strengthSets
    .where("sessionId")
    .equals(sessionId)
    .toArray((sets) => sets.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()));
}

export function getClimbAttempts(climbId: string): Promise<Attempt[]> {
  return db.attempts
    .where("climbId")
    .equals(climbId)
    .toArray((attempts) => attempts.sort((a, b) => getAttemptSortTime(a) - getAttemptSortTime(b)));
}

export async function getActiveAttempt(sessionId: string): Promise<Attempt | null> {
  return (
    (await db.attempts
      .where("sessionId")
      .equals(sessionId)
      .filter((attempt) => isActiveAttempt(attempt))
      .first()) ?? null
  );
}

export async function getActiveStrengthSet(sessionId: string): Promise<StrengthSet | null> {
  return (
    (await db.strengthSets
      .where("sessionId")
      .equals(sessionId)
      .filter((strengthSet) => strengthSet.endedAt === null)
      .first()) ?? null
  );
}

export async function createSession(initialGymId: string | null = null): Promise<Session> {
  if (initialGymId) {
    await assertUsableGym(initialGymId);
  }

  const timestamp = nowIso();
  const session: Session = {
    id: generateId(),
    startedAt: timestamp,
    endedAt: null,
    initialGymId,
    createdAt: timestamp,
  };

  await db.sessions.add(session);
  return session;
}

export async function endSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Session does not exist.");
  }
  const activeAttempt = await getActiveAttempt(sessionId);
  if (activeAttempt) {
    throw new Error("Finish or cancel the active attempt first.");
  }
  const activeStrengthSet = await getActiveStrengthSet(sessionId);
  if (activeStrengthSet) {
    throw new Error("Finish or cancel the active strength set first.");
  }

  const timestamp = nowIso();
  await db.sessions.update(sessionId, { endedAt: timestamp, updatedAt: timestamp });
}

export async function reopenSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Session does not exist.");
  }

  await db.sessions.update(sessionId, { endedAt: null, updatedAt: nowIso() });
}

export async function updateSessionReview(sessionId: string, update: SessionReviewUpdate): Promise<Session> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Session does not exist.");
  }

  const updatedAt = nowIso();
  const changes: Pick<Session, "sessionRpe" | "performance" | "memo" | "updatedAt"> = {
    sessionRpe:
      update.sessionRpe === undefined
        ? session.sessionRpe ?? null
        : validateOptionalIntegerRange(update.sessionRpe, "Session RPE", 0, 10),
    performance:
      update.performance === undefined
        ? session.performance ?? null
        : validateOptionalIntegerRange(update.performance, "Performance", 1, 5),
    memo: update.memo === undefined ? session.memo ?? null : normalizeOptionalText(update.memo),
    updatedAt,
  };

  await db.sessions.update(sessionId, changes);
  return { ...session, ...changes };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Session does not exist.");
  }

  await db.transaction("rw", db.sessions, db.climbs, db.attempts, db.strengthSets, async () => {
    const climbs = await db.climbs.where("sessionId").equals(sessionId).toArray();
    const attempts = await db.attempts.where("sessionId").equals(sessionId).toArray();
    const strengthSets = await db.strengthSets.where("sessionId").equals(sessionId).toArray();

    await db.attempts.bulkDelete(attempts.map((attempt) => attempt.id));
    await db.strengthSets.bulkDelete(strengthSets.map((strengthSet) => strengthSet.id));
    await db.climbs.bulkDelete(climbs.map((climb) => climb.id));
    await db.sessions.delete(sessionId);
  });
}

export async function createClimb(
  sessionId: string,
  grade: string,
  name: string | null,
  gymId: string | null = null,
  gradeId: string | null = null,
  wallAngle: number | null = null,
  wallAnglePresetId: string | null = null,
  wallType: "gym" | "board" = "gym",
  wallBoardId: string | null = null,
  memo: string | null = null,
): Promise<Climb> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Cannot create a climb for a missing session.");
  }

  const resolvedWall = await validateClimbWall(wallType, wallBoardId);
  const resolvedGrade = await validateClimbGymGrade(gymId, gradeId, grade);
  const resolvedWallAngle = await validateClimbWallAngle(
    gymId,
    wallAnglePresetId,
    wallAngle,
    resolvedWall.wallType,
    resolvedWall.wallBoardId,
  );
  const timestamp = nowIso();
  const climb: Climb = {
    id: generateId(),
    sessionId,
    grade: resolvedGrade,
    gymId,
    gradeId,
    wallAnglePresetId: resolvedWallAngle.wallAnglePresetId,
    ...(resolvedWallAngle.wallAngle !== null ? { wallAngle: resolvedWallAngle.wallAngle } : {}),
    wallType: resolvedWall.wallType,
    wallBoardId: resolvedWall.wallBoardId,
    wallLabel: resolvedWall.wallLabel,
    name: name && name.trim().length > 0 ? name.trim() : null,
    memo: memo && memo.trim().length > 0 ? memo.trim() : null,
    createdAt: timestamp,
  };

  await db.climbs.add(climb);
  return climb;
}

export async function updateClimb(
  climbId: string,
  grade: string,
  name: string | null,
  gymId?: string | null,
  gradeId?: string | null,
  wallAngle?: number | null,
  wallAnglePresetId?: string | null,
  wallType?: "gym" | "board",
  wallBoardId?: string | null,
  memo?: string | null,
): Promise<Climb> {
  const climb = await db.climbs.get(climbId);
  if (!climb) {
    throw new Error("Climb does not exist.");
  }

  const nextGymId = gymId === undefined ? climb.gymId ?? null : gymId;
  const nextGradeId = gradeId === undefined ? climb.gradeId ?? null : gradeId;
  const nextWallAnglePresetId = wallAnglePresetId === undefined ? climb.wallAnglePresetId ?? null : wallAnglePresetId;
  const nextWallAngle = wallAngle === undefined ? climb.wallAngle ?? null : wallAngle;
  const nextWallType = wallType === undefined ? climb.wallType ?? "gym" : wallType;
  const nextWallBoardId = wallBoardId === undefined ? climb.wallBoardId ?? null : wallBoardId;
  const resolvedWall = await validateClimbWall(nextWallType, nextWallBoardId);
  const resolvedGrade = await validateClimbGymGrade(nextGymId, nextGradeId, grade, {
    allowArchivedGymId: climb.gymId ?? null,
    allowArchivedGradeId: climb.gradeId ?? null,
  });
  const resolvedWallAngle = await validateClimbWallAngle(
    nextGymId,
    nextWallAnglePresetId,
    nextWallAngle,
    resolvedWall.wallType,
    resolvedWall.wallBoardId,
    { allowArchivedWallAngleId: climb.wallAnglePresetId ?? null },
  );
  const updatedAt = nowIso();
  const updatedClimb: Climb = {
    ...climb,
    grade: resolvedGrade,
    gymId: nextGymId,
    gradeId: nextGradeId,
    wallAnglePresetId: resolvedWallAngle.wallAnglePresetId,
    ...(resolvedWallAngle.wallAngle === null ? { wallAngle: undefined } : { wallAngle: resolvedWallAngle.wallAngle }),
    wallType: resolvedWall.wallType,
    wallBoardId: resolvedWall.wallBoardId,
    wallLabel: resolvedWall.wallLabel,
    name: name && name.trim().length > 0 ? name.trim() : null,
    memo: memo === undefined ? climb.memo ?? null : memo && memo.trim().length > 0 ? memo.trim() : null,
    updatedAt,
  };

  await db.climbs.update(climbId, {
    grade: updatedClimb.grade,
    gymId: updatedClimb.gymId,
    gradeId: updatedClimb.gradeId,
    wallAnglePresetId: updatedClimb.wallAnglePresetId,
    wallAngle: updatedClimb.wallAngle,
    wallType: updatedClimb.wallType,
    wallBoardId: updatedClimb.wallBoardId,
    wallLabel: updatedClimb.wallLabel,
    name: updatedClimb.name,
    memo: updatedClimb.memo,
    updatedAt,
  });
  return updatedClimb;
}

export async function createAttempt(
  sessionId: string,
  climbId: string,
  result: AttemptResult,
): Promise<Attempt> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Cannot create an attempt for a missing session.");
  }

  const climb = await db.climbs.get(climbId);
  if (!climb) {
    throw new Error("Cannot create an attempt for a missing climb.");
  }

  if (climb.sessionId !== sessionId) {
    throw new Error("Attempt session and climb session do not match.");
  }

  const timestamp = nowIso();
  const attempt: Attempt = {
    id: generateId(),
    sessionId,
    climbId,
    timestamp,
    startedAt: null,
    endedAt: timestamp,
    result,
    createdAt: timestamp,
  };

  await db.attempts.add(attempt);
  return attempt;
}

export async function createAttemptForLoadedSessionClimb(
  session: Session,
  climb: Climb,
  result: AttemptResult,
): Promise<Attempt> {
  if (session.endedAt) {
    throw new Error("Cannot create an attempt for an ended session.");
  }

  if (climb.sessionId !== session.id) {
    throw new Error("Attempt session and climb session do not match.");
  }

  const timestamp = nowIso();
  const attempt: Attempt = {
    id: generateId(),
    sessionId: session.id,
    climbId: climb.id,
    timestamp,
    startedAt: null,
    endedAt: timestamp,
    result,
    createdAt: timestamp,
  };

  await db.attempts.add(attempt);
  return attempt;
}

export async function startAttempt(sessionId: string, climbId: string): Promise<Attempt> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Cannot start an attempt for a missing session.");
  }
  if (session.endedAt) {
    throw new Error("Cannot start an attempt for an ended session.");
  }

  const climb = await db.climbs.get(climbId);
  if (!climb) {
    throw new Error("Cannot start an attempt for a missing climb.");
  }
  if (climb.sessionId !== sessionId) {
    throw new Error("Attempt session and climb session do not match.");
  }

  const timestamp = nowIso();
  const attempt: Attempt = {
    id: generateId(),
    sessionId,
    climbId,
    startedAt: timestamp,
    endedAt: null,
    result: null,
    createdAt: timestamp,
  };

  await db.transaction("rw", db.attempts, db.strengthSets, async () => {
    const activeAttempt = await getActiveAttempt(sessionId);
    if (activeAttempt) {
      throw new Error("Finish or cancel the active attempt first.");
    }
    const activeStrengthSet = await getActiveStrengthSet(sessionId);
    if (activeStrengthSet) {
      throw new Error("Finish or cancel the active strength set first.");
    }
    await db.attempts.add(attempt);
  });

  return attempt;
}

export async function startStrengthSet(
  sessionId: string,
  input: Pick<StrengthSetUpdate, "name" | "weight" | "reps" | "workDurationSeconds">,
): Promise<StrengthSet> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Cannot start a strength set for a missing session.");
  }
  if (session.endedAt) {
    throw new Error("Cannot start a strength set for an ended session.");
  }

  const timestamp = nowIso();
  const strengthSet: StrengthSet = {
    id: generateId(),
    sessionId,
    name: normalizeRequiredText(input.name ?? "", "Strength set name is required."),
    startedAt: timestamp,
    endedAt: null,
    weight: normalizeOptionalNonNegativeNumber(input.weight ?? null, "Weight"),
    reps: normalizeOptionalNonNegativeInteger(input.reps ?? null, "Reps"),
    workDurationSeconds: normalizeOptionalNonNegativeNumber(input.workDurationSeconds ?? null, "Work duration"),
    memo: null,
    createdAt: timestamp,
  };

  await db.transaction("rw", db.attempts, db.strengthSets, async () => {
    const activeAttempt = await getActiveAttempt(sessionId);
    if (activeAttempt) {
      throw new Error("Finish or cancel the active attempt first.");
    }
    const activeStrengthSet = await getActiveStrengthSet(sessionId);
    if (activeStrengthSet) {
      throw new Error("Finish or cancel the active strength set first.");
    }
    await db.strengthSets.add(strengthSet);
  });
  return strengthSet;
}

export async function updateStrengthSet(strengthSetId: string, update: StrengthSetUpdate): Promise<StrengthSet> {
  const strengthSet = await db.strengthSets.get(strengthSetId);
  if (!strengthSet) {
    throw new Error("Strength set does not exist.");
  }

  const startedAt =
    update.startedAt === undefined
      ? strengthSet.startedAt
      : isIsoDate(update.startedAt)
        ? new Date(update.startedAt).toISOString()
        : (() => {
            throw new Error("Strength set start time is invalid.");
          })();
  const endedAt =
    update.endedAt === undefined
      ? strengthSet.endedAt
      : update.endedAt === null
        ? null
        : isIsoDate(update.endedAt)
          ? new Date(update.endedAt).toISOString()
          : (() => {
              throw new Error("Strength set end time is invalid.");
            })();
  validateStrengthSetTime(startedAt, endedAt);

  const updatedAt = nowIso();
  const updatedStrengthSet: StrengthSet = {
    ...strengthSet,
    name: update.name === undefined ? strengthSet.name : normalizeRequiredText(update.name, "Strength set name is required."),
    startedAt,
    endedAt,
    weight: update.weight === undefined ? strengthSet.weight ?? null : normalizeOptionalNonNegativeNumber(update.weight, "Weight"),
    reps: update.reps === undefined ? strengthSet.reps ?? null : normalizeOptionalNonNegativeInteger(update.reps, "Reps"),
    workDurationSeconds:
      update.workDurationSeconds === undefined
        ? strengthSet.workDurationSeconds ?? null
        : normalizeOptionalNonNegativeNumber(update.workDurationSeconds, "Work duration"),
    effort:
      update.effort === undefined
        ? strengthSet.effort ?? null
        : update.effort === null
          ? null
          : validateEffortValue(update.effort),
    memo: update.memo === undefined ? strengthSet.memo ?? null : normalizeOptionalText(update.memo),
    updatedAt,
  };

  await db.strengthSets.update(strengthSetId, {
    name: updatedStrengthSet.name,
    startedAt: updatedStrengthSet.startedAt,
    endedAt: updatedStrengthSet.endedAt,
    weight: updatedStrengthSet.weight,
    reps: updatedStrengthSet.reps,
    workDurationSeconds: updatedStrengthSet.workDurationSeconds,
    effort: updatedStrengthSet.effort,
    memo: updatedStrengthSet.memo,
    updatedAt,
  });
  return updatedStrengthSet;
}

export async function finishStrengthSet(strengthSetId: string): Promise<StrengthSet> {
  const strengthSet = await db.strengthSets.get(strengthSetId);
  if (!strengthSet) {
    throw new Error("Strength set does not exist.");
  }
  if (strengthSet.endedAt !== null) {
    throw new Error("Only an active strength set can be finished.");
  }
  return updateStrengthSet(strengthSetId, { endedAt: nowIso() });
}

export async function cancelStrengthSet(strengthSetId: string): Promise<void> {
  const strengthSet = await db.strengthSets.get(strengthSetId);
  if (!strengthSet) {
    throw new Error("Strength set does not exist.");
  }
  if (strengthSet.endedAt !== null) {
    throw new Error("Only an active strength set can be canceled.");
  }
  await db.strengthSets.delete(strengthSetId);
}

export async function updateStrengthSetMetadata(
  strengthSetId: string,
  effort: EffortRating | null,
  memo?: string | null,
): Promise<StrengthSet> {
  return updateStrengthSet(strengthSetId, { effort, memo });
}

export async function finishAttempt(attemptId: string, result: AttemptResult): Promise<Attempt> {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) {
    throw new Error("Attempt does not exist.");
  }
  if (!isActiveAttempt(attempt)) {
    throw new Error("Only an active attempt can be finished.");
  }

  const endedAt = nowIso();
  if (attempt.startedAt && new Date(endedAt).getTime() < new Date(attempt.startedAt).getTime()) {
    throw new Error("Attempt end time cannot be before start time.");
  }

  const update = {
    endedAt,
    timestamp: endedAt,
    result,
    updatedAt: endedAt,
  };
  await db.attempts.update(attemptId, update);
  return { ...attempt, ...update };
}

export async function cancelAttempt(attemptId: string): Promise<void> {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) {
    throw new Error("Attempt does not exist.");
  }
  if (!isActiveAttempt(attempt)) {
    throw new Error("Only an active attempt can be canceled.");
  }

  await db.attempts.delete(attemptId);
}

export async function updateAttempt(attemptId: string, update: AttemptUpdate): Promise<Attempt> {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) {
    throw new Error("Attempt does not exist.");
  }

  const climb = await db.climbs.get(update.climbId);
  if (!climb) {
    throw new Error("Cannot move attempt to a missing climb.");
  }

  const session = await db.sessions.get(attempt.sessionId);
  if (!session) {
    throw new Error("Attempt session does not exist.");
  }

  if (climb.sessionId !== attempt.sessionId) {
    throw new Error("Attempt cannot be moved to a climb in another session.");
  }

  if (
    (update.startedAt && !isIsoDate(update.startedAt)) ||
    (update.endedAt && !isIsoDate(update.endedAt)) ||
    (update.timestamp && !isIsoDate(update.timestamp))
  ) {
    throw new Error("Attempt time is invalid.");
  }
  const startedAt =
    update.startedAt === undefined
      ? attempt.startedAt
      : update.startedAt
        ? new Date(update.startedAt).toISOString()
        : null;
  const endedAt =
    update.endedAt === undefined
      ? update.timestamp
        ? new Date(update.timestamp).toISOString()
        : attempt.endedAt
      : update.endedAt
        ? new Date(update.endedAt).toISOString()
        : null;
  validateAttemptState(startedAt, endedAt, update.result);

  const sessionStartedMs = new Date(session.startedAt).getTime();
  const sessionEndedMs = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const rangeTimes = [startedAt, endedAt].filter((value): value is string => Boolean(value));
  if (rangeTimes.some((value) => new Date(value).getTime() < sessionStartedMs || new Date(value).getTime() > sessionEndedMs)) {
    throw new Error("Attempt time must stay within the session range.");
  }

  if (endedAt === null) {
    const activeAttempt = await getActiveAttempt(attempt.sessionId);
    if (activeAttempt && activeAttempt.id !== attemptId) {
      throw new Error("Finish or cancel the active attempt first.");
    }
  }

  const updatedAt = nowIso();
  const updatedAttempt: Attempt = {
    ...attempt,
    climbId: update.climbId,
    result: update.result,
    startedAt,
    endedAt,
    timestamp: endedAt ?? undefined,
    effort: update.effort === null ? undefined : update.effort === undefined ? attempt.effort : validateEffortValue(update.effort),
    note: update.note === undefined ? attempt.note ?? null : normalizeOptionalText(update.note),
    updatedAt,
  };

  await db.attempts.update(attemptId, {
    climbId: updatedAttempt.climbId,
    result: updatedAttempt.result,
    startedAt: updatedAttempt.startedAt,
    endedAt: updatedAttempt.endedAt,
    timestamp: updatedAttempt.timestamp,
    effort: updatedAttempt.effort,
    note: updatedAttempt.note,
    updatedAt,
  });
  return updatedAttempt;
}

export async function updateAttemptEffort(
  attemptId: string,
  effort: AttemptEffort | null,
  note?: string | null,
): Promise<Attempt> {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) {
    throw new Error("Attempt does not exist.");
  }

  const update = {
    effort: effort === null ? undefined : validateEffortValue(effort),
    note: note === undefined ? attempt.note ?? null : normalizeOptionalText(note),
    updatedAt: nowIso(),
  };
  await db.attempts.update(attemptId, update);
  return { ...attempt, ...update };
}

export async function deleteAttempt(attemptId: string): Promise<void> {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) {
    throw new Error("Attempt does not exist.");
  }

  await db.attempts.delete(attemptId);
}

export async function exportAllData(): Promise<DataExport> {
  const [gyms, boards, grades, wallAngles, sessions, climbs, attempts, strengthSets] = await Promise.all([
    db.gyms.toArray(),
    db.boards.toArray(),
    db.grades.toArray(),
    db.wallAngles.toArray(),
    db.sessions.toArray(),
    db.climbs.toArray(),
    db.attempts.toArray(),
    db.strengthSets.toArray(),
  ]);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: nowIso(),
    gyms,
    boards,
    grades,
    wallAngles,
    sessions,
    climbs,
    attempts,
    strengthSets,
  };
}

export async function restoreAllData(data: unknown): Promise<DataExport> {
  const backup = validateDataExport(data);

  await db.transaction("rw", [db.gyms, db.boards, db.grades, db.wallAngles, db.sessions, db.climbs, db.attempts, db.strengthSets], async () => {
    await db.strengthSets.clear();
    await db.attempts.clear();
    await db.climbs.clear();
    await db.sessions.clear();
    await db.wallAngles.clear();
    await db.grades.clear();
    await db.boards.clear();
    await db.gyms.clear();
    await db.gyms.bulkAdd(backup.gyms);
    await db.boards.bulkAdd(backup.boards);
    await db.grades.bulkAdd(backup.grades);
    await db.wallAngles.bulkAdd(backup.wallAngles);
    await db.sessions.bulkAdd(backup.sessions);
    await db.climbs.bulkAdd(backup.climbs);
    await db.attempts.bulkAdd(backup.attempts);
    await db.strengthSets.bulkAdd(backup.strengthSets);
  });

  return backup;
}

export function validateDataExport(data: unknown): DataExport {
  if (!isRecord(data)) {
    throw new Error("Backup must be a JSON object.");
  }

  if (
    data.schemaVersion !== 2 &&
    data.schemaVersion !== 3 &&
    data.schemaVersion !== 4 &&
    data.schemaVersion !== 5 &&
    data.schemaVersion !== 6 &&
    data.schemaVersion !== 7 &&
    data.schemaVersion !== 8 &&
    data.schemaVersion !== 9 &&
    data.schemaVersion !== 10 &&
    data.schemaVersion !== 11 &&
    data.schemaVersion !== 12
  ) {
    throw new Error("Unsupported backup schema version.");
  }

  if (typeof data.exportedAt !== "string" || !isIsoDate(data.exportedAt)) {
    throw new Error("Backup exportedAt is invalid.");
  }

  if (!Array.isArray(data.sessions) || !Array.isArray(data.climbs) || !Array.isArray(data.attempts)) {
    throw new Error("Backup must include sessions, climbs, and attempts arrays.");
  }
  if (
    (data.schemaVersion === 3 ||
      data.schemaVersion === 4 ||
      data.schemaVersion === 5 ||
      data.schemaVersion === 6 ||
      data.schemaVersion === 7 ||
      data.schemaVersion === 8 ||
      data.schemaVersion === 9 ||
      data.schemaVersion === 10 ||
      data.schemaVersion === 11 ||
      data.schemaVersion === 12) &&
    (!Array.isArray(data.gyms) || !Array.isArray(data.grades))
  ) {
    throw new Error("Backup must include gyms and grades arrays.");
  }
  if (
    (data.schemaVersion === 5 ||
      data.schemaVersion === 6 ||
      data.schemaVersion === 7 ||
      data.schemaVersion === 8 ||
      data.schemaVersion === 9 ||
      data.schemaVersion === 10 ||
      data.schemaVersion === 11 ||
      data.schemaVersion === 12) &&
    !Array.isArray(data.wallAngles)
  ) {
    throw new Error("Backup must include wallAngles array.");
  }
  if (
    (data.schemaVersion === 6 ||
      data.schemaVersion === 7 ||
      data.schemaVersion === 8 ||
      data.schemaVersion === 9 ||
      data.schemaVersion === 10 ||
      data.schemaVersion === 11 ||
      data.schemaVersion === 12) &&
    !Array.isArray(data.boards)
  ) {
    throw new Error("Backup must include boards array.");
  }
  if (data.schemaVersion === 12 && !Array.isArray(data.strengthSets)) {
    throw new Error("Backup must include strengthSets array.");
  }

  const rawGyms = Array.isArray(data.gyms) ? data.gyms : [];
  const rawBoards = Array.isArray(data.boards) ? data.boards : [];
  const rawGrades = Array.isArray(data.grades) ? data.grades : [];
  const rawWallAngles = Array.isArray(data.wallAngles) ? data.wallAngles : [];
  const rawStrengthSets = Array.isArray(data.strengthSets) ? data.strengthSets : [];
  const hasGymMaster =
    data.schemaVersion === 3 ||
    data.schemaVersion === 4 ||
    data.schemaVersion === 5 ||
    data.schemaVersion === 6 ||
    data.schemaVersion === 7 ||
    data.schemaVersion === 8 ||
    data.schemaVersion === 9 ||
    data.schemaVersion === 10 ||
    data.schemaVersion === 11 ||
    data.schemaVersion === 12;
  const gyms: Gym[] = hasGymMaster ? rawGyms.map(validateGym) : [];
  const boards: Board[] =
    data.schemaVersion === 6 ||
    data.schemaVersion === 7 ||
    data.schemaVersion === 8 ||
    data.schemaVersion === 9 ||
    data.schemaVersion === 10 ||
    data.schemaVersion === 11 ||
    data.schemaVersion === 12
      ? rawBoards.map(validateBoard)
      : [];
  const grades: Grade[] = hasGymMaster ? rawGrades.map(validateGrade) : [];
  const wallAngles: WallAngle[] =
    data.schemaVersion === 5 ||
    data.schemaVersion === 6 ||
    data.schemaVersion === 7 ||
    data.schemaVersion === 8 ||
    data.schemaVersion === 9 ||
    data.schemaVersion === 10 ||
    data.schemaVersion === 11 ||
    data.schemaVersion === 12
      ? rawWallAngles.map(validateWallAngle)
      : [];
  const sessions: Session[] = data.sessions.map(validateSession);
  const climbs: Climb[] = data.climbs.map(validateClimb);
  const attempts: Attempt[] = data.attempts.map(validateAttempt);
  const strengthSets: StrengthSet[] = data.schemaVersion === 12 ? rawStrengthSets.map(validateStrengthSet) : [];
  const gymIds = new Set(gyms.map((gym) => gym.id));
  const boardIds = new Set(boards.map((board) => board.id));
  const gradeById = new Map(grades.map((grade) => [grade.id, grade]));
  const wallAngleById = new Map(wallAngles.map((wallAngle) => [wallAngle.id, wallAngle]));
  const sessionIds = new Set(sessions.map((session) => session.id));
  const climbById = new Map(climbs.map((climb) => [climb.id, climb]));

  if (gymIds.size !== gyms.length) {
    throw new Error("Backup contains duplicate gym ids.");
  }
  if (boardIds.size !== boards.length) {
    throw new Error("Backup contains duplicate board ids.");
  }
  if (gradeById.size !== grades.length) {
    throw new Error("Backup contains duplicate grade ids.");
  }
  if (wallAngleById.size !== wallAngles.length) {
    throw new Error("Backup contains duplicate wall angle ids.");
  }
  if (sessionIds.size !== sessions.length) {
    throw new Error("Backup contains duplicate session ids.");
  }
  if (climbById.size !== climbs.length) {
    throw new Error("Backup contains duplicate climb ids.");
  }
  if (new Set(attempts.map((attempt) => attempt.id)).size !== attempts.length) {
    throw new Error("Backup contains duplicate attempt ids.");
  }
  if (new Set(strengthSets.map((strengthSet) => strengthSet.id)).size !== strengthSets.length) {
    throw new Error("Backup contains duplicate strength set ids.");
  }

  for (const grade of grades) {
    if (grade.gymId && !gymIds.has(grade.gymId)) {
      throw new Error("Backup contains a grade for a missing gym.");
    }
    if (grade.boardId && !boardIds.has(grade.boardId)) {
      throw new Error("Backup contains a grade for a missing board.");
    }
    if (!grade.gymId && !grade.boardId) {
      throw new Error("Backup grade owner is invalid.");
    }
  }

  for (const wallAngle of wallAngles) {
    if (wallAngle.gymId && !gymIds.has(wallAngle.gymId)) {
      throw new Error("Backup contains a wall angle for a missing gym.");
    }
    if (wallAngle.boardId && !boardIds.has(wallAngle.boardId)) {
      throw new Error("Backup contains a wall angle for a missing board.");
    }
    if (!wallAngle.gymId && !wallAngle.boardId) {
      throw new Error("Backup wall angle owner is invalid.");
    }
  }

  for (const session of sessions) {
    if (session.initialGymId && !gymIds.has(session.initialGymId)) {
      throw new Error("Backup contains a session for a missing initial gym.");
    }
  }

  for (const climb of climbs) {
    if (!sessionIds.has(climb.sessionId)) {
      throw new Error("Backup contains a climb for a missing session.");
    }
    if (climb.gymId && !gymIds.has(climb.gymId)) {
      throw new Error("Backup contains a climb for a missing gym.");
    }
    if (climb.gradeId) {
      const grade = gradeById.get(climb.gradeId);
      if (grade && climb.gymId && grade.gymId !== climb.gymId) {
        throw new Error("Backup contains a climb whose gym and grade do not match.");
      }
    }
    if (climb.wallAnglePresetId) {
      const wallAngle = wallAngleById.get(climb.wallAnglePresetId);
      if (wallAngle && climb.gymId && wallAngle.gymId !== climb.gymId) {
        throw new Error("Backup contains a climb whose gym and wall angle do not match.");
      }
    }
    if (climb.wallType === "board" && climb.wallBoardId && !boardIds.has(climb.wallBoardId)) {
      throw new Error("Backup contains a climb for a missing board.");
    }
  }

  for (const attempt of attempts) {
    const climb = climbById.get(attempt.climbId);
    if (!sessionIds.has(attempt.sessionId)) {
      throw new Error("Backup contains an attempt for a missing session.");
    }
    if (!climb) {
      throw new Error("Backup contains an attempt for a missing climb.");
    }
    if (climb.sessionId !== attempt.sessionId) {
      throw new Error("Backup contains an attempt whose climb belongs to another session.");
    }
  }

  for (const strengthSet of strengthSets) {
    if (!sessionIds.has(strengthSet.sessionId)) {
      throw new Error("Backup contains a strength set for a missing session.");
    }
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: data.exportedAt,
    gyms,
    boards,
    grades,
    wallAngles,
    sessions,
    climbs,
    attempts,
    strengthSets,
  };
}

async function assertUsableGym(gymId: string): Promise<Gym> {
  const gym = await db.gyms.get(gymId);
  if (!gym) {
    throw new Error("Gym does not exist.");
  }
  if (gym.isArchived) {
    throw new Error("Archived gyms cannot be used for new records.");
  }
  return gym;
}

async function validateClimbGymGrade(
  gymId: string | null,
  gradeId: string | null,
  fallbackGrade: string,
  options: { allowArchivedGymId?: string | null; allowArchivedGradeId?: string | null } = {},
): Promise<string> {
  if (gymId) {
    const gym = await db.gyms.get(gymId);
    if (!gym) {
      throw new Error("Gym does not exist.");
    }
    if (gym.isArchived && gym.id !== options.allowArchivedGymId) {
      throw new Error("Archived gyms cannot be used for new records.");
    }
  }

  if (!gradeId) {
    return normalizeRequiredText(fallbackGrade, "Grade is required.");
  }

  if (!gymId) {
    throw new Error("A grade cannot be used without a gym.");
  }

  const grade = await db.grades.get(gradeId);
  if (!grade) {
    throw new Error("Grade does not exist.");
  }
  if (grade.gymId && grade.gymId !== gymId) {
    throw new Error("Climb gym and grade do not match.");
  }
  if (grade.isArchived && grade.id !== options.allowArchivedGradeId) {
    throw new Error("Archived grades cannot be used for new records.");
  }

  return grade.label;
}

async function validateClimbWallAngle(
  gymId: string | null,
  wallAnglePresetId: string | null,
  fallbackWallAngle: number | null,
  wallType: "gym" | "board",
  wallBoardId: string | null,
  options: { allowArchivedWallAngleId?: string | null } = {},
): Promise<{ wallAngle: number | null; wallAnglePresetId: string | null }> {
  if (!wallAnglePresetId) {
    return {
      wallAngle: fallbackWallAngle === null ? null : validateWallAngleValue(fallbackWallAngle),
      wallAnglePresetId: null,
    };
  }

  if (!gymId) {
    throw new Error("A wall angle preset cannot be used without a gym.");
  }

  const wallAngle = await db.wallAngles.get(wallAnglePresetId);
  if (!wallAngle) {
    return {
      wallAngle: fallbackWallAngle === null ? null : validateWallAngleValue(fallbackWallAngle),
      wallAnglePresetId: null,
    };
  }
  if (wallType === "board") {
    if (!wallBoardId || wallAngle.boardId !== wallBoardId) {
      throw new Error("Climb wall and wall angle do not match.");
    }
  } else if (wallAngle.gymId !== gymId) {
    throw new Error("Climb gym and wall angle do not match.");
  }
  if (wallAngle.isArchived && wallAngle.id !== options.allowArchivedWallAngleId) {
    throw new Error("Archived wall angles cannot be used for new records.");
  }

  return {
    wallAngle: validateWallAngleValue(fallbackWallAngle ?? wallAngle.angle),
    wallAnglePresetId: wallAngle.id,
  };
}

async function validateClimbWall(
  wallType: "gym" | "board",
  wallBoardId: string | null,
): Promise<{ wallType: "gym" | "board"; wallBoardId: string | null; wallLabel: string }> {
  if (wallType === "gym") {
    return { wallType: "gym", wallBoardId: null, wallLabel: "Gym Wall" };
  }

  if (!wallBoardId) {
    throw new Error("A board wall requires a board.");
  }
  const board = await db.boards.get(wallBoardId);
  if (!board) {
    throw new Error("Board does not exist.");
  }
  if (board.isArchived) {
    throw new Error("Archived boards cannot be used for new records.");
  }

  return { wallType: "board", wallBoardId, wallLabel: board.name };
}

function validateAttemptState(
  startedAt: string | null,
  endedAt: string | null,
  result: AttemptResult | null,
): void {
  if (startedAt && endedAt && new Date(endedAt).getTime() < new Date(startedAt).getTime()) {
    throw new Error("Attempt end time cannot be before start time.");
  }
  if (endedAt === null && result !== null) {
    throw new Error("Active attempts cannot have a result.");
  }
  if (endedAt !== null && result === null) {
    throw new Error("Completed attempts require a result.");
  }
}

function isActiveAttempt(attempt: Attempt): boolean {
  return attempt.startedAt !== null && attempt.endedAt === null;
}

function getAttemptSortTime(attempt: Attempt): number {
  return new Date(attempt.startedAt ?? attempt.endedAt ?? attempt.timestamp ?? attempt.createdAt).getTime();
}

function normalizeRequiredText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
}

function normalizeOptionalText(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

type MasterOwner = { type: "gym"; id: string } | { type: "board"; id: string };

function getOwnerFilter(owner: MasterOwner) {
  return owner.type === "gym" ? { gymId: owner.id, boardId: null } : { gymId: null, boardId: owner.id };
}

async function getOwnerGrades(owner: MasterOwner): Promise<Grade[]> {
  if (owner.type === "gym") {
    return db.grades.where("gymId").equals(owner.id).toArray();
  }
  return db.grades.where("boardId").equals(owner.id).toArray();
}

async function getOwnerWallAngles(owner: MasterOwner): Promise<WallAngle[]> {
  if (owner.type === "gym") {
    return db.wallAngles.where("gymId").equals(owner.id).toArray();
  }
  return db.wallAngles.where("boardId").equals(owner.id).toArray();
}

function assertUniqueValues<T>(values: T[], message: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(message);
  }
}

async function replaceGradeRecords(owner: MasterOwner, labels: string[]): Promise<Grade[]> {
  const normalizedLabels = labels.map((label) => normalizeRequiredText(label, "Grade label is required."));
  assertUniqueValues(normalizedLabels, "Grade labels must be unique.");
  const timestamp = nowIso();
  const ownerFields = getOwnerFilter(owner);

  let activeGrades: Grade[] = [];
  await db.transaction("rw", db.grades, db.climbs, async () => {
    const existing = await getOwnerGrades(owner);
    const existingByLabel = new Map(existing.map((grade) => [grade.label, grade]));
    const retainedIds = new Set<string>();

    const nextGrades: Grade[] = [];
    for (const [order, label] of normalizedLabels.entries()) {
      const existingGrade = existingByLabel.get(label);
      if (existingGrade) {
        const updatedGrade: Grade = {
          ...existingGrade,
          ...ownerFields,
          label,
          order,
          isArchived: false,
          updatedAt: timestamp,
        };
        await db.grades.update(existingGrade.id, {
          label,
          order,
          isArchived: false,
          updatedAt: timestamp,
        });
        retainedIds.add(existingGrade.id);
        nextGrades.push(updatedGrade);
        continue;
      }

      const grade: Grade = {
        id: generateId(),
        ...ownerFields,
        label,
        order,
        isArchived: false,
        createdAt: timestamp,
      };
      await db.grades.add(grade);
      nextGrades.push(grade);
    }

    for (const grade of existing) {
      if (retainedIds.has(grade.id)) {
        continue;
      }
      const climbCount = await db.climbs.where("gradeId").equals(grade.id).count();
      if (climbCount > 0) {
        await db.grades.update(grade.id, { isArchived: true, updatedAt: timestamp });
      } else {
        await db.grades.delete(grade.id);
      }
    }

    activeGrades = nextGrades;
  });

  return activeGrades;
}

async function replaceWallAngleRecords(owner: MasterOwner, angles: number[]): Promise<WallAngle[]> {
  const normalizedAngles = angles.map(validateWallAngleValue);
  assertUniqueValues(normalizedAngles, "Wall angles must be unique.");
  const timestamp = nowIso();
  const ownerFields = getOwnerFilter(owner);

  let activeWallAngles: WallAngle[] = [];
  await db.transaction("rw", db.wallAngles, db.climbs, async () => {
    const existing = await getOwnerWallAngles(owner);
    const existingByAngle = new Map(existing.map((wallAngle) => [wallAngle.angle, wallAngle]));
    const retainedIds = new Set<string>();

    const nextWallAngles: WallAngle[] = [];
    for (const [order, angle] of normalizedAngles.entries()) {
      const existingWallAngle = existingByAngle.get(angle);
      if (existingWallAngle) {
        const updatedWallAngle: WallAngle = {
          ...existingWallAngle,
          ...ownerFields,
          angle,
          order,
          isArchived: false,
          updatedAt: timestamp,
        };
        await db.wallAngles.update(existingWallAngle.id, {
          angle,
          order,
          isArchived: false,
          updatedAt: timestamp,
        });
        retainedIds.add(existingWallAngle.id);
        nextWallAngles.push(updatedWallAngle);
        continue;
      }

      const wallAngle: WallAngle = {
        id: generateId(),
        ...ownerFields,
        angle,
        order,
        isArchived: false,
        createdAt: timestamp,
      };
      await db.wallAngles.add(wallAngle);
      nextWallAngles.push(wallAngle);
    }

    for (const wallAngle of existing) {
      if (retainedIds.has(wallAngle.id)) {
        continue;
      }
      const climbCount = await db.climbs.where("wallAnglePresetId").equals(wallAngle.id).count();
      if (climbCount > 0) {
        await db.wallAngles.update(wallAngle.id, { isArchived: true, updatedAt: timestamp });
      } else {
        await db.wallAngles.delete(wallAngle.id);
      }
    }

    activeWallAngles = nextWallAngles;
  });

  return activeWallAngles;
}

async function reorderGradeRecords(grades: Grade[], orderedGradeIds: string[], ownerError: string): Promise<void> {
  const existingIds = new Set(grades.map((grade) => grade.id));
  if (orderedGradeIds.length !== grades.length || new Set(orderedGradeIds).size !== orderedGradeIds.length) {
    throw new Error("Grade order is invalid.");
  }
  if (!orderedGradeIds.every((gradeId) => existingIds.has(gradeId))) {
    throw new Error(ownerError);
  }

  const timestamp = nowIso();
  await db.transaction("rw", db.grades, async () => {
    await Promise.all(
      orderedGradeIds.map((gradeId, order) => db.grades.update(gradeId, { order, updatedAt: timestamp })),
    );
  });
}

async function reorderWallAngleRecords(
  wallAngles: WallAngle[],
  orderedWallAngleIds: string[],
  ownerError: string,
): Promise<void> {
  const existingIds = new Set(wallAngles.map((angle) => angle.id));
  if (
    orderedWallAngleIds.length !== wallAngles.length ||
    new Set(orderedWallAngleIds).size !== orderedWallAngleIds.length
  ) {
    throw new Error("Wall angle order is invalid.");
  }
  if (!orderedWallAngleIds.every((wallAngleId) => existingIds.has(wallAngleId))) {
    throw new Error(ownerError);
  }

  const timestamp = nowIso();
  await db.transaction("rw", db.wallAngles, async () => {
    await Promise.all(
      orderedWallAngleIds.map((wallAngleId, order) => db.wallAngles.update(wallAngleId, { order, updatedAt: timestamp })),
    );
  });
}

function validateGym(value: unknown): Gym {
  if (!isRecord(value)) {
    throw new Error("Backup gym is invalid.");
  }
  const gym: Gym = {
    id: readString(value, "id"),
    name: readString(value, "name"),
    isArchived: readBoolean(value, "isArchived"),
    createdAt: readIsoString(value, "createdAt"),
  };
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    gym.updatedAt = updatedAt;
  }
  return gym;
}

function validateBoard(value: unknown): Board {
  if (!isRecord(value)) {
    throw new Error("Backup board is invalid.");
  }
  const board: Board = {
    id: readString(value, "id"),
    name: readString(value, "name"),
    isArchived: readBoolean(value, "isArchived"),
    createdAt: readIsoString(value, "createdAt"),
  };
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    board.updatedAt = updatedAt;
  }
  return board;
}

function validateGrade(value: unknown): Grade {
  if (!isRecord(value)) {
    throw new Error("Backup grade is invalid.");
  }
  const order = readNumber(value, "order");
  if (!Number.isInteger(order) || order < 0) {
    throw new Error("Backup grade order is invalid.");
  }
  const grade: Grade = {
    id: readString(value, "id"),
    gymId: readOptionalNullableString(value, "gymId"),
    boardId: readOptionalNullableString(value, "boardId"),
    label: readString(value, "label"),
    order,
    isArchived: readBoolean(value, "isArchived"),
    createdAt: readIsoString(value, "createdAt"),
  };
  if (!grade.gymId && !grade.boardId) {
    throw new Error("Backup grade owner is invalid.");
  }
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    grade.updatedAt = updatedAt;
  }
  return grade;
}

function validateWallAngle(value: unknown): WallAngle {
  if (!isRecord(value)) {
    throw new Error("Backup wall angle is invalid.");
  }
  const order = readNumber(value, "order");
  if (!Number.isInteger(order) || order < 0) {
    throw new Error("Backup wall angle order is invalid.");
  }
  const wallAngle: WallAngle = {
    id: readString(value, "id"),
    gymId: readOptionalNullableString(value, "gymId"),
    boardId: readOptionalNullableString(value, "boardId"),
    angle: validateWallAngleValue(readNumber(value, "angle")),
    order,
    isArchived: readOptionalBoolean(value, "isArchived") ?? false,
    createdAt: readIsoString(value, "createdAt"),
  };
  if (!wallAngle.gymId && !wallAngle.boardId) {
    throw new Error("Backup wall angle owner is invalid.");
  }
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    wallAngle.updatedAt = updatedAt;
  }
  return wallAngle;
}

function validateSession(value: unknown): Session {
  if (!isRecord(value)) {
    throw new Error("Backup session is invalid.");
  }
  const session: Session = {
    id: readString(value, "id"),
    startedAt: readIsoString(value, "startedAt"),
    endedAt: readNullableIsoString(value, "endedAt"),
    initialGymId: readOptionalNullableString(value, "initialGymId"),
    createdAt: readIsoString(value, "createdAt"),
  };
  const sessionRpe = readOptionalNullableNumber(value, "sessionRpe");
  if (sessionRpe !== undefined) {
    session.sessionRpe = validateOptionalIntegerRange(sessionRpe, "Session RPE", 0, 10);
  }
  const performance = readOptionalNullableNumber(value, "performance");
  if (performance !== undefined) {
    session.performance = validateOptionalIntegerRange(performance, "Performance", 1, 5);
  }
  const memo = readOptionalNullableString(value, "memo");
  if (memo !== null || Object.prototype.hasOwnProperty.call(value, "memo")) {
    session.memo = normalizeOptionalText(memo);
  }
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    session.updatedAt = updatedAt;
  }
  return session;
}

function validateClimb(value: unknown): Climb {
  if (!isRecord(value)) {
    throw new Error("Backup climb is invalid.");
  }
  const climb: Climb = {
    id: readString(value, "id"),
    sessionId: readString(value, "sessionId"),
    grade: readString(value, "grade"),
    gymId: readOptionalNullableString(value, "gymId"),
    gradeId: readOptionalNullableString(value, "gradeId"),
    wallAnglePresetId: readOptionalNullableString(value, "wallAnglePresetId"),
    wallType: readOptionalWallType(value, "wallType"),
    wallBoardId: readOptionalNullableString(value, "wallBoardId"),
    wallLabel: readOptionalNullableString(value, "wallLabel") ?? "Gym Wall",
    name: readNullableString(value, "name"),
    memo: readOptionalNullableString(value, "memo"),
    createdAt: readIsoString(value, "createdAt"),
  };
  const wallAngle = readOptionalNumber(value, "wallAngle");
  if (wallAngle !== undefined) {
    climb.wallAngle = validateWallAngleValue(wallAngle);
  }
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    climb.updatedAt = updatedAt;
  }
  return climb;
}

function validateAttempt(value: unknown): Attempt {
  if (!isRecord(value)) {
    throw new Error("Backup attempt is invalid.");
  }
  const rawResult = value.result;
  if (rawResult !== "fail" && rawResult !== "send" && rawResult !== null) {
    throw new Error("Backup attempt result is invalid.");
  }
  const timestamp = readOptionalIsoString(value, "timestamp");
  const startedAt = readOptionalNullableIsoString(value, "startedAt");
  const endedAt = readOptionalNullableIsoString(value, "endedAt") ?? timestamp ?? null;
  const result = rawResult;
  if (result !== "fail" && result !== "send" && result !== null) {
    throw new Error("Backup attempt result is invalid.");
  }
  validateAttemptState(startedAt, endedAt, result);
  const normalizedTimestamp = timestamp ?? endedAt ?? undefined;
  const attempt: Attempt = {
    id: readString(value, "id"),
    sessionId: readString(value, "sessionId"),
    climbId: readString(value, "climbId"),
    ...(normalizedTimestamp ? { timestamp: normalizedTimestamp } : {}),
    startedAt,
    endedAt,
    result,
    note: readOptionalNullableString(value, "note"),
    createdAt: readIsoString(value, "createdAt"),
  };
  const effort = readOptionalNumber(value, "effort");
  if (effort !== undefined) {
    attempt.effort = validateEffortValue(effort);
  }
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    attempt.updatedAt = updatedAt;
  }
  return attempt;
}

function validateStrengthSet(value: unknown): StrengthSet {
  if (!isRecord(value)) {
    throw new Error("Backup strength set is invalid.");
  }
  const startedAt = readIsoString(value, "startedAt");
  const endedAt = readOptionalNullableIsoString(value, "endedAt");
  validateStrengthSetTime(startedAt, endedAt);
  const strengthSet: StrengthSet = {
    id: readString(value, "id"),
    sessionId: readString(value, "sessionId"),
    name: normalizeRequiredText(readString(value, "name"), "Strength set name is required."),
    startedAt,
    endedAt,
    weight: normalizeOptionalNonNegativeNumber(readOptionalNumber(value, "weight") ?? null, "Weight"),
    reps: normalizeOptionalNonNegativeInteger(readOptionalNumber(value, "reps") ?? null, "Reps"),
    workDurationSeconds: normalizeOptionalNonNegativeNumber(readOptionalNumber(value, "workDurationSeconds") ?? null, "Work duration"),
    memo: readOptionalNullableString(value, "memo"),
    createdAt: readIsoString(value, "createdAt"),
  };
  const effort = readOptionalNumber(value, "effort");
  if (effort !== undefined) {
    strengthSet.effort = validateEffortValue(effort);
  }
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    strengthSet.updatedAt = updatedAt;
  }
  return strengthSet;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readOptionalNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readOptionalWallType(record: Record<string, unknown>, key: string): "gym" | "board" {
  const value = record[key];
  if (value === undefined || value === null) {
    return "gym";
  }
  if (value !== "gym" && value !== "board") {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readOptionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readOptionalNullableNumber(record: Record<string, unknown>, key: string): number | null | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function validateOptionalIntegerRange(value: number | null, label: string, min: number, max: number): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function validateEffortValue(value: number): AttemptEffort {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    throw new Error("Attempt effort must be between 1 and 7.");
  }
  return value as AttemptEffort;
}

function normalizeOptionalNonNegativeNumber(value: number | null | undefined, label: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return value;
}

function normalizeOptionalNonNegativeInteger(value: number | null | undefined, label: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value;
}

function validateStrengthSetTime(startedAt: string, endedAt: string | null) {
  if (!isIsoDate(startedAt)) {
    throw new Error("Strength set start time is invalid.");
  }
  if (endedAt !== null && !isIsoDate(endedAt)) {
    throw new Error("Strength set end time is invalid.");
  }
  if (endedAt !== null && new Date(endedAt).getTime() < new Date(startedAt).getTime()) {
    throw new Error("Strength set end time cannot be before start time.");
  }
}

function validateWallAngleValue(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Wall angle is invalid.");
  }
  if (value < 0 || value > 180) {
    throw new Error("Wall angle must be between 0 and 180 degrees.");
  }
  return Object.is(value, -0) ? 0 : value;
}

function readIsoString(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!isIsoDate(value)) {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readNullableIsoString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || !isIsoDate(value)) {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readOptionalIsoString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || !isIsoDate(value)) {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function readOptionalNullableIsoString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || !isIsoDate(value)) {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}
