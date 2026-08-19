import Dexie, { type EntityTable } from "dexie";
import type { Attempt, Climb, Grade, Gym, Session } from "../types/domain";

export const db = new Dexie("climbingLogger") as Dexie & {
  gyms: EntityTable<Gym, "id">;
  grades: EntityTable<Grade, "id">;
  sessions: EntityTable<Session, "id">;
  climbs: EntityTable<Climb, "id">;
  attempts: EntityTable<Attempt, "id">;
};

db.version(1).stores({
  sessions: "id, startedAt, endedAt, createdAt",
  climbs: "id, sessionId, createdAt",
  attempts: "id, sessionId, climbId, timestamp, createdAt",
});

db.version(2).stores({
  sessions: "id, startedAt, endedAt, createdAt, updatedAt",
  climbs: "id, sessionId, createdAt, updatedAt",
  attempts: "id, sessionId, climbId, timestamp, createdAt, updatedAt",
});

db.version(3).stores({
  gyms: "id, name, isArchived, createdAt, updatedAt",
  grades: "id, gymId, order, isArchived, createdAt, updatedAt",
  sessions: "id, startedAt, endedAt, initialGymId, createdAt, updatedAt",
  climbs: "id, sessionId, gymId, gradeId, createdAt, updatedAt",
  attempts: "id, sessionId, climbId, timestamp, createdAt, updatedAt",
});

db.version(4).stores({
  gyms: "id, name, isArchived, createdAt, updatedAt",
  grades: "id, gymId, order, isArchived, createdAt, updatedAt",
  sessions: "id, startedAt, endedAt, initialGymId, createdAt, updatedAt",
  climbs: "id, sessionId, gymId, gradeId, wallAngle, createdAt, updatedAt",
  attempts: "id, sessionId, climbId, timestamp, result, effort, createdAt, updatedAt",
});
