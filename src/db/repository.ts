import { db } from "./db";
import type { Attempt, AttemptResult, Climb, Grade, Gym, Session } from "../types/domain";
import { generateId } from "../utils/id";
import { nowIso } from "../utils/time";

const CURRENT_SCHEMA_VERSION = 3;

export type DataExport = {
  schemaVersion: number;
  exportedAt: string;
  gyms: Gym[];
  grades: Grade[];
  sessions: Session[];
  climbs: Climb[];
  attempts: Attempt[];
};

export type AttemptUpdate = {
  result: AttemptResult;
  timestamp: string;
  climbId: string;
};

export function getAllGyms(): Promise<Gym[]> {
  return db.gyms.orderBy("name").toArray();
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

export function getGymGrades(gymId: string, includeArchived = false): Promise<Grade[]> {
  return db.grades
    .where("gymId")
    .equals(gymId)
    .filter((grade) => includeArchived || !grade.isArchived)
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

  await db.transaction("rw", db.gyms, db.grades, async () => {
    const grades = await db.grades.where("gymId").equals(gymId).toArray();
    await db.grades.bulkDelete(grades.map((grade) => grade.id));
    await db.gyms.delete(gymId);
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

export async function updateGrade(gradeId: string, label: string): Promise<void> {
  const grade = await db.grades.get(gradeId);
  if (!grade) {
    throw new Error("Grade does not exist.");
  }

  await db.grades.update(gradeId, {
    label: normalizeRequiredText(label, "Grade label is required."),
    updatedAt: nowIso(),
  });
}

export async function archiveGrade(gradeId: string, isArchived = true): Promise<void> {
  const grade = await db.grades.get(gradeId);
  if (!grade) {
    throw new Error("Grade does not exist.");
  }

  await db.grades.update(gradeId, { isArchived, updatedAt: nowIso() });
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

  const grades = await getGymGrades(grade.gymId, true);
  const index = grades.findIndex((item) => item.id === gradeId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= grades.length) {
    return;
  }

  const reordered = [...grades];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved);
  await reorderGrades(
    grade.gymId,
    reordered.map((item) => item.id),
  );
}

export async function reorderGrades(gymId: string, orderedGradeIds: string[]): Promise<void> {
  const grades = await getGymGrades(gymId, true);
  const existingIds = new Set(grades.map((grade) => grade.id));
  if (orderedGradeIds.length !== grades.length || new Set(orderedGradeIds).size !== orderedGradeIds.length) {
    throw new Error("Grade order is invalid.");
  }
  if (!orderedGradeIds.every((gradeId) => existingIds.has(gradeId))) {
    throw new Error("Grade order contains a grade from another gym.");
  }

  const timestamp = nowIso();
  await db.transaction("rw", db.grades, async () => {
    await Promise.all(
      orderedGradeIds.map((gradeId, order) => db.grades.update(gradeId, { order, updatedAt: timestamp })),
    );
  });
}

export function getAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy("startedAt").reverse().toArray();
}

export function getAllAttempts(): Promise<Attempt[]> {
  return db.attempts.toArray();
}

export function getAllClimbs(): Promise<Climb[]> {
  return db.climbs.toArray();
}

export async function getActiveSession(): Promise<Session | null> {
  return (await db.sessions.filter((session) => session.endedAt === null).first()) ?? null;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  return (await db.sessions.get(sessionId)) ?? null;
}

export function getSessionClimbs(sessionId: string): Promise<Climb[]> {
  return db.climbs.where("sessionId").equals(sessionId).sortBy("createdAt");
}

export function getSessionAttempts(sessionId: string): Promise<Attempt[]> {
  return db.attempts.where("sessionId").equals(sessionId).sortBy("timestamp");
}

export function getClimbAttempts(climbId: string): Promise<Attempt[]> {
  return db.attempts.where("climbId").equals(climbId).sortBy("timestamp");
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

export async function deleteSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Session does not exist.");
  }

  await db.transaction("rw", db.sessions, db.climbs, db.attempts, async () => {
    const climbs = await db.climbs.where("sessionId").equals(sessionId).toArray();
    const attempts = await db.attempts.where("sessionId").equals(sessionId).toArray();

    await db.attempts.bulkDelete(attempts.map((attempt) => attempt.id));
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
): Promise<Climb> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Cannot create a climb for a missing session.");
  }

  const resolvedGrade = await validateClimbGymGrade(gymId, gradeId, grade);
  const timestamp = nowIso();
  const climb: Climb = {
    id: generateId(),
    sessionId,
    grade: resolvedGrade,
    gymId,
    gradeId,
    name: name && name.trim().length > 0 ? name.trim() : null,
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
): Promise<void> {
  const climb = await db.climbs.get(climbId);
  if (!climb) {
    throw new Error("Climb does not exist.");
  }

  const nextGymId = gymId === undefined ? climb.gymId ?? null : gymId;
  const nextGradeId = gradeId === undefined ? climb.gradeId ?? null : gradeId;
  const resolvedGrade = await validateClimbGymGrade(nextGymId, nextGradeId, grade, {
    allowArchivedGymId: climb.gymId ?? null,
    allowArchivedGradeId: climb.gradeId ?? null,
  });

  await db.climbs.update(climbId, {
    grade: resolvedGrade,
    gymId: nextGymId,
    gradeId: nextGradeId,
    name: name && name.trim().length > 0 ? name.trim() : null,
    updatedAt: nowIso(),
  });
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
    result,
    createdAt: timestamp,
  };

  await db.attempts.add(attempt);
  return attempt;
}

export async function updateAttempt(attemptId: string, update: AttemptUpdate): Promise<void> {
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

  const timestampMs = new Date(update.timestamp).getTime();
  if (Number.isNaN(timestampMs)) {
    throw new Error("Attempt timestamp is invalid.");
  }

  const sessionStartedMs = new Date(session.startedAt).getTime();
  const sessionEndedMs = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  if (timestampMs < sessionStartedMs || timestampMs > sessionEndedMs) {
    throw new Error("Attempt time must stay within the session range.");
  }

  await db.attempts.update(attemptId, {
    climbId: update.climbId,
    result: update.result,
    timestamp: new Date(update.timestamp).toISOString(),
    updatedAt: nowIso(),
  });
}

export async function deleteAttempt(attemptId: string): Promise<void> {
  const attempt = await db.attempts.get(attemptId);
  if (!attempt) {
    throw new Error("Attempt does not exist.");
  }

  await db.attempts.delete(attemptId);
}

export async function exportAllData(): Promise<DataExport> {
  const [gyms, grades, sessions, climbs, attempts] = await Promise.all([
    db.gyms.toArray(),
    db.grades.toArray(),
    db.sessions.toArray(),
    db.climbs.toArray(),
    db.attempts.toArray(),
  ]);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: nowIso(),
    gyms,
    grades,
    sessions,
    climbs,
    attempts,
  };
}

export async function restoreAllData(data: unknown): Promise<DataExport> {
  const backup = validateDataExport(data);

  await db.transaction("rw", db.gyms, db.grades, db.sessions, db.climbs, db.attempts, async () => {
    await db.attempts.clear();
    await db.climbs.clear();
    await db.sessions.clear();
    await db.grades.clear();
    await db.gyms.clear();
    await db.gyms.bulkAdd(backup.gyms);
    await db.grades.bulkAdd(backup.grades);
    await db.sessions.bulkAdd(backup.sessions);
    await db.climbs.bulkAdd(backup.climbs);
    await db.attempts.bulkAdd(backup.attempts);
  });

  return backup;
}

export function validateDataExport(data: unknown): DataExport {
  if (!isRecord(data)) {
    throw new Error("Backup must be a JSON object.");
  }

  if (data.schemaVersion !== 2 && data.schemaVersion !== 3) {
    throw new Error("Unsupported backup schema version.");
  }

  if (typeof data.exportedAt !== "string" || !isIsoDate(data.exportedAt)) {
    throw new Error("Backup exportedAt is invalid.");
  }

  if (!Array.isArray(data.sessions) || !Array.isArray(data.climbs) || !Array.isArray(data.attempts)) {
    throw new Error("Backup must include sessions, climbs, and attempts arrays.");
  }
  if (data.schemaVersion === 3 && (!Array.isArray(data.gyms) || !Array.isArray(data.grades))) {
    throw new Error("Backup must include gyms and grades arrays.");
  }

  const rawGyms = Array.isArray(data.gyms) ? data.gyms : [];
  const rawGrades = Array.isArray(data.grades) ? data.grades : [];
  const gyms: Gym[] = data.schemaVersion === 3 ? rawGyms.map(validateGym) : [];
  const grades: Grade[] = data.schemaVersion === 3 ? rawGrades.map(validateGrade) : [];
  const sessions: Session[] = data.sessions.map(validateSession);
  const climbs: Climb[] = data.climbs.map(validateClimb);
  const attempts: Attempt[] = data.attempts.map(validateAttempt);
  const gymIds = new Set(gyms.map((gym) => gym.id));
  const gradeById = new Map(grades.map((grade) => [grade.id, grade]));
  const sessionIds = new Set(sessions.map((session) => session.id));
  const climbById = new Map(climbs.map((climb) => [climb.id, climb]));

  if (gymIds.size !== gyms.length) {
    throw new Error("Backup contains duplicate gym ids.");
  }
  if (gradeById.size !== grades.length) {
    throw new Error("Backup contains duplicate grade ids.");
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

  for (const grade of grades) {
    if (!gymIds.has(grade.gymId)) {
      throw new Error("Backup contains a grade for a missing gym.");
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
      if (!grade) {
        throw new Error("Backup contains a climb for a missing grade.");
      }
      if (climb.gymId && grade.gymId !== climb.gymId) {
        throw new Error("Backup contains a climb whose gym and grade do not match.");
      }
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

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: data.exportedAt,
    gyms,
    grades,
    sessions,
    climbs,
    attempts,
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
  if (grade.gymId !== gymId) {
    throw new Error("Climb gym and grade do not match.");
  }
  if (grade.isArchived && grade.id !== options.allowArchivedGradeId) {
    throw new Error("Archived grades cannot be used for new records.");
  }

  return grade.label;
}

function normalizeRequiredText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
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
    gymId: readString(value, "gymId"),
    label: readString(value, "label"),
    order,
    isArchived: readBoolean(value, "isArchived"),
    createdAt: readIsoString(value, "createdAt"),
  };
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    grade.updatedAt = updatedAt;
  }
  return grade;
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
    name: readNullableString(value, "name"),
    createdAt: readIsoString(value, "createdAt"),
  };
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
  const result = readString(value, "result");
  if (result !== "fail" && result !== "send") {
    throw new Error("Backup attempt result is invalid.");
  }
  const attempt: Attempt = {
    id: readString(value, "id"),
    sessionId: readString(value, "sessionId"),
    climbId: readString(value, "climbId"),
    timestamp: readIsoString(value, "timestamp"),
    result,
    createdAt: readIsoString(value, "createdAt"),
  };
  const updatedAt = readOptionalIsoString(value, "updatedAt");
  if (updatedAt) {
    attempt.updatedAt = updatedAt;
  }
  return attempt;
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

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
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
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !isIsoDate(value)) {
    throw new Error(`Backup ${key} is invalid.`);
  }
  return value;
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}
