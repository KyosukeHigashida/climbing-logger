import { db } from "./db";
import type { Attempt, AttemptResult, Climb, Session } from "../types/domain";
import { generateId } from "../utils/id";
import { nowIso } from "../utils/time";

export type DataExport = {
  schemaVersion: number;
  exportedAt: string;
  sessions: Session[];
  climbs: Climb[];
  attempts: Attempt[];
};

export type AttemptUpdate = {
  result: AttemptResult;
  timestamp: string;
  climbId: string;
};

export function getAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy("startedAt").reverse().toArray();
}

export function getAllAttempts(): Promise<Attempt[]> {
  return db.attempts.toArray();
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

export async function createSession(): Promise<Session> {
  const timestamp = nowIso();
  const session: Session = {
    id: generateId(),
    startedAt: timestamp,
    endedAt: null,
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
): Promise<Climb> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Cannot create a climb for a missing session.");
  }

  const timestamp = nowIso();
  const climb: Climb = {
    id: generateId(),
    sessionId,
    grade,
    name: name && name.trim().length > 0 ? name.trim() : null,
    createdAt: timestamp,
  };

  await db.climbs.add(climb);
  return climb;
}

export async function updateClimb(climbId: string, grade: string, name: string | null): Promise<void> {
  const climb = await db.climbs.get(climbId);
  if (!climb) {
    throw new Error("Climb does not exist.");
  }

  await db.climbs.update(climbId, {
    grade,
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
  const [sessions, climbs, attempts] = await Promise.all([
    db.sessions.toArray(),
    db.climbs.toArray(),
    db.attempts.toArray(),
  ]);

  return {
    schemaVersion: 2,
    exportedAt: nowIso(),
    sessions,
    climbs,
    attempts,
  };
}

export async function restoreAllData(data: unknown): Promise<DataExport> {
  const backup = validateDataExport(data);

  await db.transaction("rw", db.sessions, db.climbs, db.attempts, async () => {
    await db.attempts.clear();
    await db.climbs.clear();
    await db.sessions.clear();
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

  if (data.schemaVersion !== 2) {
    throw new Error("Unsupported backup schema version.");
  }

  if (typeof data.exportedAt !== "string" || !isIsoDate(data.exportedAt)) {
    throw new Error("Backup exportedAt is invalid.");
  }

  if (!Array.isArray(data.sessions) || !Array.isArray(data.climbs) || !Array.isArray(data.attempts)) {
    throw new Error("Backup must include sessions, climbs, and attempts arrays.");
  }

  const sessions = data.sessions.map(validateSession);
  const climbs = data.climbs.map(validateClimb);
  const attempts = data.attempts.map(validateAttempt);
  const sessionIds = new Set(sessions.map((session) => session.id));
  const climbById = new Map(climbs.map((climb) => [climb.id, climb]));

  if (sessionIds.size !== sessions.length) {
    throw new Error("Backup contains duplicate session ids.");
  }
  if (climbById.size !== climbs.length) {
    throw new Error("Backup contains duplicate climb ids.");
  }
  if (new Set(attempts.map((attempt) => attempt.id)).size !== attempts.length) {
    throw new Error("Backup contains duplicate attempt ids.");
  }

  for (const climb of climbs) {
    if (!sessionIds.has(climb.sessionId)) {
      throw new Error("Backup contains a climb for a missing session.");
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
    schemaVersion: 2,
    exportedAt: data.exportedAt,
    sessions,
    climbs,
    attempts,
  };
}

function validateSession(value: unknown): Session {
  if (!isRecord(value)) {
    throw new Error("Backup session is invalid.");
  }
  const session: Session = {
    id: readString(value, "id"),
    startedAt: readIsoString(value, "startedAt"),
    endedAt: readNullableIsoString(value, "endedAt"),
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
