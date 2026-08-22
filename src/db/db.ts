import Dexie, { type EntityTable } from "dexie";
import type { Attempt, Board, Climb, Grade, Gym, Session, StrengthSet, WallAngle } from "../types/domain";

export const db = new Dexie("climbingLogger") as Dexie & {
  gyms: EntityTable<Gym, "id">;
  boards: EntityTable<Board, "id">;
  grades: EntityTable<Grade, "id">;
  wallAngles: EntityTable<WallAngle, "id">;
  sessions: EntityTable<Session, "id">;
  climbs: EntityTable<Climb, "id">;
  attempts: EntityTable<Attempt, "id">;
  strengthSets: EntityTable<StrengthSet, "id">;
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

db.version(5).stores({
  gyms: "id, name, isArchived, createdAt, updatedAt",
  grades: "id, gymId, order, isArchived, createdAt, updatedAt",
  wallAngles: "id, gymId, order, angle, createdAt, updatedAt",
  sessions: "id, startedAt, endedAt, initialGymId, createdAt, updatedAt",
  climbs: "id, sessionId, gymId, gradeId, wallAnglePresetId, wallAngle, createdAt, updatedAt",
  attempts: "id, sessionId, climbId, timestamp, result, effort, createdAt, updatedAt",
});

db.version(6)
  .stores({
    gyms: "id, name, isArchived, createdAt, updatedAt",
    boards: "id, name, isArchived, createdAt, updatedAt",
    grades: "id, gymId, order, isArchived, createdAt, updatedAt",
    wallAngles: "id, gymId, order, angle, createdAt, updatedAt",
    sessions: "id, startedAt, endedAt, initialGymId, createdAt, updatedAt",
    climbs:
      "id, sessionId, gymId, gradeId, wallAnglePresetId, wallType, wallBoardId, wallAngle, createdAt, updatedAt",
    attempts:
      "id, sessionId, climbId, startedAt, endedAt, result, timestamp, effort, createdAt, updatedAt",
  })
  .upgrade(async (transaction) => {
    const attempts = transaction.table("attempts");
    await attempts.toCollection().modify((attempt) => {
      if (attempt.startedAt === undefined) {
        attempt.startedAt = null;
      }
      if (attempt.endedAt === undefined) {
        attempt.endedAt = attempt.timestamp ?? null;
      }
      if (attempt.timestamp === undefined && attempt.endedAt) {
        attempt.timestamp = attempt.endedAt;
      }
    });

    const climbs = transaction.table("climbs");
    await climbs.toCollection().modify((climb) => {
      if (climb.wallType === undefined) {
        climb.wallType = "gym";
      }
      if (climb.wallBoardId === undefined) {
        climb.wallBoardId = null;
      }
      if (climb.wallLabel === undefined) {
        climb.wallLabel = "Gym Wall";
      }
    });
  });

db.version(7).stores({
  gyms: "id, name, isArchived, createdAt, updatedAt",
  boards: "id, name, isArchived, createdAt, updatedAt",
  grades: "id, gymId, boardId, order, isArchived, createdAt, updatedAt",
  wallAngles: "id, gymId, boardId, order, angle, createdAt, updatedAt",
  sessions: "id, startedAt, endedAt, initialGymId, createdAt, updatedAt",
  climbs:
    "id, sessionId, gymId, gradeId, wallAnglePresetId, wallType, wallBoardId, wallAngle, createdAt, updatedAt",
  attempts:
    "id, sessionId, climbId, startedAt, endedAt, result, timestamp, effort, createdAt, updatedAt",
});

db.version(8)
  .stores({
    gyms: "id, name, isArchived, createdAt, updatedAt",
    boards: "id, name, isArchived, createdAt, updatedAt",
    grades: "id, gymId, boardId, order, isArchived, createdAt, updatedAt",
    wallAngles: "id, gymId, boardId, order, angle, isArchived, createdAt, updatedAt",
    sessions: "id, startedAt, endedAt, initialGymId, createdAt, updatedAt",
    climbs:
      "id, sessionId, gymId, gradeId, wallAnglePresetId, wallType, wallBoardId, wallAngle, createdAt, updatedAt",
    attempts:
      "id, sessionId, climbId, startedAt, endedAt, result, timestamp, effort, createdAt, updatedAt",
  })
  .upgrade(async (transaction) => {
    const wallAngles = transaction.table("wallAngles");
    await wallAngles.toCollection().modify((wallAngle) => {
      if (wallAngle.isArchived === undefined) {
        wallAngle.isArchived = false;
      }
    });

    const allAngles = await wallAngles.toArray();
    const angleById = new Map(allAngles.map((angle) => [angle.id, angle]));
    const climbs = transaction.table("climbs");
    await climbs.toCollection().modify((climb) => {
      if (!climb.wallAnglePresetId || angleById.has(climb.wallAnglePresetId)) {
        return;
      }
      const matchingAngle = allAngles.find(
        (angle) =>
          angle.angle === climb.wallAngle &&
          ((climb.wallType === "board" && climb.wallBoardId && angle.boardId === climb.wallBoardId) ||
            ((climb.wallType === undefined || climb.wallType === "gym") && angle.gymId === climb.gymId)),
      );
      climb.wallAnglePresetId = matchingAngle?.id ?? null;
    });
  });

db.version(9).stores({
  gyms: "id, name, isArchived, createdAt, updatedAt",
  boards: "id, name, isArchived, createdAt, updatedAt",
  grades: "id, gymId, boardId, order, isArchived, createdAt, updatedAt",
  wallAngles: "id, gymId, boardId, order, angle, isArchived, createdAt, updatedAt",
  sessions: "id, startedAt, endedAt, initialGymId, createdAt, updatedAt",
  climbs:
    "id, sessionId, gymId, gradeId, wallAnglePresetId, wallType, wallBoardId, wallAngle, createdAt, updatedAt",
  attempts:
    "id, sessionId, climbId, startedAt, endedAt, result, timestamp, effort, createdAt, updatedAt",
  strengthSets: "id, sessionId, startedAt, endedAt, createdAt, updatedAt",
});
