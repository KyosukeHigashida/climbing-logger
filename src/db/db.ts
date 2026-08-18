import Dexie, { type EntityTable } from "dexie";
import type { Attempt, Climb, Session } from "../types/domain";

export const db = new Dexie("climbingLogger") as Dexie & {
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
