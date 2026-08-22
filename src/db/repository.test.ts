import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import {
  archiveGrade,
  archiveGym,
  createBoard,
  createBoardGrade,
  createBoardWallAngle,
  createAttempt,
  createAttemptForLoadedSessionClimb,
  createClimb,
  createGrade,
  createGym,
  createWallAngle,
  createSession,
  cancelAttempt,
  cancelStrengthSet,
  deleteAttempt,
  deleteGrade,
  deleteGym,
  deleteSession,
  deleteWallAngle,
  endSession,
  exportAllData,
  finishAttempt,
  finishStrengthSet,
  getActiveAttempt,
  getActiveSession,
  getActiveStrengthSet,
  getBoardGrades,
  getBoardWallAngles,
  getGymGrades,
  getGymWallAngles,
  getSessionAttempts,
  getSessionClimbs,
  loadActiveSessionSnapshot,
  loadCurrentActiveSessionSnapshot,
  moveGrade,
  reorderGrades,
  replaceBoardGrades,
  replaceBoardWallAngles,
  replaceGymGrades,
  replaceGymWallAngles,
  reopenSession,
  restoreAllData,
  startAttempt,
  startStrengthSet,
  updateAttempt,
  updateAttemptEffort,
  updateClimb,
  updateGrade,
  updateSessionReview,
  updateStrengthSet,
  updateStrengthSetMetadata,
  updateWallAngle,
  validateDataExport,
} from "./repository";
import type { Climb, Session } from "../types/domain";
import { getAttemptCount, getFailCount, getSendCount, sortAttemptsByTimestampDesc } from "../utils/attempts";
import { anglePresets, gradePresets } from "../utils/presets";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function setNow(iso: string) {
  vi.setSystemTime(new Date(iso));
}

async function insertSession(session: Session) {
  await db.sessions.add(session);
}

async function insertClimb(climb: Climb) {
  await db.climbs.add(climb);
}

describe("repository", () => {
  it("creates gyms and grades, reorders grades, archives records, and deletes only unused records", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const gym = await createGym("BETA");
    const gradeA = await createGrade(gym.id, "2Q");
    const gradeB = await createGrade(gym.id, "1Q");

    expect((await getGymGrades(gym.id)).map((grade) => grade.label)).toEqual(["2Q", "1Q"]);

    await moveGrade(gradeB.id, "up");
    expect((await getGymGrades(gym.id)).map((grade) => grade.label)).toEqual(["1Q", "2Q"]);

    await reorderGrades(gym.id, [gradeA.id, gradeB.id]);
    expect((await getGymGrades(gym.id)).map((grade) => grade.label)).toEqual(["2Q", "1Q"]);

    await archiveGrade(gradeA.id);
    expect((await getGymGrades(gym.id)).map((grade) => grade.id)).toEqual([gradeB.id]);

    await archiveGym(gym.id);
    expect((await db.gyms.get(gym.id))?.isArchived).toBe(true);
    await archiveGym(gym.id, false);

    await deleteGrade(gradeA.id);
    expect(await db.grades.get(gradeA.id)).toBeUndefined();

    const unusedGym = await createGym("Unused");
    await createGrade(unusedGym.id, "V4");
    await deleteGym(unusedGym.id);
    expect(await db.gyms.get(unusedGym.id)).toBeUndefined();
    expect(await db.grades.where("gymId").equals(unusedGym.id).count()).toBe(0);
  });

  it("rejects hard delete for used gyms and grades", async () => {
    const gym = await createGym("B-PUMP");
    const grade = await createGrade(gym.id, "3Q");
    const session = await createSession(gym.id);
    await createClimb(session.id, grade.label, "Green", gym.id, grade.id);

    await expect(deleteGrade(grade.id)).rejects.toThrow("Used grades can only be archived.");
    await expect(deleteGym(gym.id)).rejects.toThrow("Used gyms can only be archived.");
  });

  it("loads grade presets as editable gym master data", async () => {
    const gym = await createGym("BETA");

    await replaceGymGrades(gym.id, gradePresets["kyu-dan"].labels);
    let grades = await getGymGrades(gym.id);
    expect(grades.map((grade) => grade.label)).toEqual(gradePresets["kyu-dan"].labels);

    await updateGrade(grades[0].id, "10級+");
    grades = await getGymGrades(gym.id);
    expect(grades[0].label).toBe("10級+");

    await replaceGymGrades(gym.id, gradePresets["q-d"].labels);
    grades = await getGymGrades(gym.id);
    expect(grades.map((grade) => grade.label)).toEqual(gradePresets["q-d"].labels);

    await replaceGymGrades(gym.id, gradePresets["v-grade"].labels);
    grades = await getGymGrades(gym.id);
    expect(grades.map((grade) => grade.label)).toEqual(gradePresets["v-grade"].labels);
    expect(grades.map((grade) => grade.label)).toContain("V12");

    await replaceGymGrades(gym.id, gradePresets["empty"].labels);
    expect(await getGymGrades(gym.id)).toEqual([]);
  });

  it("updates gym grade masters without orphaning used climb grade ids", async () => {
    const gym = await createGym("BETA");
    const grades = await replaceGymGrades(gym.id, ["2Q", "1Q", "1D"]);
    const usedGrade = grades[0];
    const unusedGrade = grades[1];
    const session = await createSession(gym.id);
    const climb = await createClimb(session.id, usedGrade.label, "Used", gym.id, usedGrade.id);

    const replaced = await replaceGymGrades(gym.id, ["2Q", "3D"]);

    expect(replaced[0].id).toBe(usedGrade.id);
    expect(await db.grades.get(unusedGrade.id)).toBeUndefined();
    expect(await db.grades.get(usedGrade.id)).toMatchObject({ isArchived: false, label: "2Q", order: 0 });
    expect((await getGymGrades(gym.id)).map((grade) => grade.label)).toEqual(["2Q", "3D"]);
    expect(await db.climbs.get(climb.id)).toMatchObject({ gradeId: usedGrade.id });

    await replaceGymGrades(gym.id, ["3D"]);
    expect(await db.grades.get(usedGrade.id)).toMatchObject({ isArchived: true });
    expect((await getGymGrades(gym.id)).map((grade) => grade.id)).not.toContain(usedGrade.id);
    expect((await getGymGrades(gym.id, true)).map((grade) => grade.id)).toContain(usedGrade.id);
    expect(await db.climbs.get(climb.id)).toMatchObject({ gradeId: usedGrade.id });
  });

  it("loads wall angle presets as editable gym master data", async () => {
    const gym = await createGym("BETA");

    await replaceGymWallAngles(gym.id, anglePresets["fixed-10"].angles);
    let wallAngles = await getGymWallAngles(gym.id);
    expect(wallAngles.map((angle) => angle.angle)).toEqual(anglePresets["fixed-10"].angles);

    await updateWallAngle(wallAngles[0].id, 92);
    wallAngles = await getGymWallAngles(gym.id);
    expect(wallAngles[0].angle).toBe(92);

    await replaceGymWallAngles(gym.id, anglePresets["fixed-5"].angles);
    wallAngles = await getGymWallAngles(gym.id);
    expect(wallAngles.map((angle) => angle.angle)).toEqual(anglePresets["fixed-5"].angles);

    await replaceGymWallAngles(gym.id, anglePresets["board-5"].angles);
    wallAngles = await getGymWallAngles(gym.id);
    expect(wallAngles.map((angle) => angle.angle)).toEqual(anglePresets["board-5"].angles);

    const custom = await createWallAngle(gym.id, 117);
    expect((await getGymWallAngles(gym.id)).map((angle) => angle.angle)).toContain(117);
    await deleteWallAngle(custom.id);
    expect((await getGymWallAngles(gym.id)).map((angle) => angle.id)).not.toContain(custom.id);

    await replaceGymWallAngles(gym.id, anglePresets["empty"].angles);
    expect(await getGymWallAngles(gym.id)).toEqual([]);
  });

  it("updates gym wall angle masters without orphaning used climb wall angle ids", async () => {
    const gym = await createGym("BETA");
    const wallAngles = await replaceGymWallAngles(gym.id, [110, 120, 130]);
    const usedAngle = wallAngles[1];
    const unusedAngle = wallAngles[0];
    const session = await createSession(gym.id);
    const climb = await createClimb(session.id, "2Q", "Used", gym.id, null, usedAngle.angle, usedAngle.id);

    const replaced = await replaceGymWallAngles(gym.id, [120, 140]);

    expect(replaced[0].id).toBe(usedAngle.id);
    expect(await db.wallAngles.get(unusedAngle.id)).toBeUndefined();
    expect(await db.wallAngles.get(usedAngle.id)).toMatchObject({ isArchived: false, angle: 120, order: 0 });
    expect((await getGymWallAngles(gym.id)).map((angle) => angle.angle)).toEqual([120, 140]);
    expect(await db.climbs.get(climb.id)).toMatchObject({ wallAnglePresetId: usedAngle.id });

    await replaceGymWallAngles(gym.id, [140]);
    expect(await db.wallAngles.get(usedAngle.id)).toMatchObject({ isArchived: true });
    expect((await getGymWallAngles(gym.id)).map((angle) => angle.id)).not.toContain(usedAngle.id);
    expect((await getGymWallAngles(gym.id, true)).map((angle) => angle.id)).toContain(usedAngle.id);
    expect(await db.climbs.get(climb.id)).toMatchObject({ wallAnglePresetId: usedAngle.id });
  });

  it("adds duplicate wall angles idempotently and rejects impossible angle values", async () => {
    const gym = await createGym("BETA");
    const board = await createBoard("Kilter Board");

    const gymAngle = await createWallAngle(gym.id, 120);
    const duplicateGymAngle = await createWallAngle(gym.id, 120);
    expect(duplicateGymAngle.id).toBe(gymAngle.id);
    expect(await getGymWallAngles(gym.id)).toHaveLength(1);

    const boardAngle = await createBoardWallAngle(board.id, 40);
    const duplicateBoardAngle = await createBoardWallAngle(board.id, 40);
    expect(duplicateBoardAngle.id).toBe(boardAngle.id);
    expect(await getBoardWallAngles(board.id)).toHaveLength(1);

    await expect(createWallAngle(gym.id, -1)).rejects.toThrow("Wall angle must be between 0 and 180 degrees.");
    await expect(createWallAngle(gym.id, 181)).rejects.toThrow("Wall angle must be between 0 and 180 degrees.");
    await expect(createBoardWallAngle(board.id, Number.NaN)).rejects.toThrow("Wall angle is invalid.");
  });

  it("archives used wall angles on delete and reuses archived ids idempotently", async () => {
    const gym = await createGym("BETA");
    const wallAngle = await createWallAngle(gym.id, 120);
    const session = await createSession(gym.id);
    await createClimb(session.id, "2Q", "Used", gym.id, null, wallAngle.angle, wallAngle.id);

    await deleteWallAngle(wallAngle.id);
    expect(await db.wallAngles.get(wallAngle.id)).toMatchObject({ isArchived: true });
    expect(await getGymWallAngles(gym.id)).toEqual([]);

    const restored = await createWallAngle(gym.id, 120);
    expect(restored.id).toBe(wallAngle.id);
    expect(restored.isArchived).toBe(false);
  });

  it("loads board grade and wall angle presets as editable board master data", async () => {
    const board = await createBoard("Kilter Board");

    await replaceBoardGrades(board.id, gradePresets["v-grade"].labels);
    let grades = await getBoardGrades(board.id);
    expect(grades.map((grade) => grade.label)).toEqual(gradePresets["v-grade"].labels);
    expect(grades[0]).toMatchObject({ boardId: board.id, gymId: null });

    await updateGrade(grades[0].id, "V0+");
    grades = await getBoardGrades(board.id);
    expect(grades[0].label).toBe("V0+");

    await replaceBoardWallAngles(board.id, anglePresets["board-5"].angles);
    let wallAngles = await getBoardWallAngles(board.id);
    expect(wallAngles.map((angle) => angle.angle)).toEqual(anglePresets["board-5"].angles);
    expect(wallAngles[0]).toMatchObject({ boardId: board.id, gymId: null });

    await updateWallAngle(wallAngles[0].id, 22);
    wallAngles = await getBoardWallAngles(board.id);
    expect(wallAngles[0].angle).toBe(22);

    const customGrade = await createBoardGrade(board.id, "Custom");
    const customAngle = await createBoardWallAngle(board.id, 47);
    expect((await getBoardGrades(board.id)).map((grade) => grade.id)).toContain(customGrade.id);
    expect((await getBoardWallAngles(board.id)).map((angle) => angle.id)).toContain(customAngle.id);
  });

  it("keeps board grade and wall angle masters isolated from gym masters", async () => {
    const gym = await createGym("BETA");
    const board = await createBoard("Kilter Board");
    const [gymGrade] = await replaceGymGrades(gym.id, ["V4"]);
    const [boardGrade] = await replaceBoardGrades(board.id, ["V4"]);
    const [gymAngle] = await replaceGymWallAngles(gym.id, [40]);
    const [boardAngle] = await replaceBoardWallAngles(board.id, [40]);

    expect(gymGrade.id).not.toBe(boardGrade.id);
    expect(gymAngle.id).not.toBe(boardAngle.id);
    expect(await getGymGrades(gym.id)).toHaveLength(1);
    expect(await getBoardGrades(board.id)).toHaveLength(1);
    expect(await getGymWallAngles(gym.id)).toHaveLength(1);
    expect(await getBoardWallAngles(board.id)).toHaveLength(1);
  });

  it("validates climb gym and grade relationships at repository level", async () => {
    const gymA = await createGym("BETA");
    const gymB = await createGym("Kilter Board");
    const gradeA = await createGrade(gymA.id, "2Q");
    const gradeB = await createGrade(gymB.id, "V4");
    const session = await createSession(gymA.id);

    const climb = await createClimb(session.id, gradeA.label, "A", gymA.id, gradeA.id);
    expect(climb).toMatchObject({
      gymId: gymA.id,
      gradeId: gradeA.id,
      grade: "2Q",
    });

    await expect(createClimb(session.id, gradeB.label, "Wrong", gymA.id, gradeB.id)).rejects.toThrow(
      "Climb gym and grade do not match.",
    );

    await archiveGrade(gradeA.id);
    await expect(createClimb(session.id, gradeA.label, "Archived", gymA.id, gradeA.id)).rejects.toThrow(
      "Archived grades cannot be used for new records.",
    );
  });

  it("stores per-climb venue when current venue changes without mutating existing climbs", async () => {
    const beta = await createGym("BETA");
    const kilter = await createGym("Kilter Board");
    const betaGrade = await createGrade(beta.id, "2Q");
    const kilterGrade = await createGrade(kilter.id, "V4");
    const session = await createSession(beta.id);

    const climbA = await createClimb(session.id, betaGrade.label, "A", beta.id, betaGrade.id);
    const climbB = await createClimb(session.id, kilterGrade.label, "B", kilter.id, kilterGrade.id);
    const climbC = await createClimb(session.id, betaGrade.label, "C", beta.id, betaGrade.id);

    expect((await db.sessions.get(session.id))?.initialGymId).toBe(beta.id);
    expect((await db.climbs.get(climbA.id))?.gymId).toBe(beta.id);
    expect((await db.climbs.get(climbB.id))?.gymId).toBe(kilter.id);
    expect((await db.climbs.get(climbC.id))?.gymId).toBe(beta.id);
  });

  it("keeps climb grade and wall angle snapshots after gym master records change", async () => {
    const gym = await createGym("BETA");
    const [grade] = await replaceGymGrades(gym.id, ["2Q"]);
    const [wallAngle] = await replaceGymWallAngles(gym.id, [120]);
    const session = await createSession(gym.id);

    const climb = await createClimb(session.id, grade.label, "Yellow", gym.id, grade.id, wallAngle.angle, wallAngle.id);

    await updateGrade(grade.id, "2Q+");
    await updateWallAngle(wallAngle.id, 125);

    expect(await db.climbs.get(climb.id)).toMatchObject({
      grade: "2Q",
      gradeId: grade.id,
      wallAnglePresetId: wallAngle.id,
      wallAngle: 120,
    });
  });

  it("keeps existing climb wall angle snapshots after the master angle is deleted", async () => {
    const gym = await createGym("BETA");
    const [grade] = await replaceGymGrades(gym.id, ["2Q"]);
    const [wallAngle] = await replaceGymWallAngles(gym.id, [120]);
    const session = await createSession(gym.id);
    const climb = await createClimb(session.id, grade.label, "Yellow", gym.id, grade.id, wallAngle.angle, wallAngle.id);

    await deleteWallAngle(wallAngle.id);
    await updateClimb(climb.id, "2Q", "Yellow renamed", gym.id, grade.id, 120, wallAngle.id);

    expect(await db.climbs.get(climb.id)).toMatchObject({
      name: "Yellow renamed",
      wallAnglePresetId: wallAngle.id,
      wallAngle: 120,
    });
  });

  it("stores board grade and wall angle snapshots on climbs", async () => {
    const gym = await createGym("BETA");
    const board = await createBoard("Kilter Board");
    const [grade] = await replaceBoardGrades(board.id, ["V4"]);
    const [wallAngle] = await replaceBoardWallAngles(board.id, [40]);
    const session = await createSession(gym.id);

    const climb = await createClimb(
      session.id,
      grade.label,
      "Board climb",
      gym.id,
      grade.id,
      wallAngle.angle,
      wallAngle.id,
      "board",
      board.id,
    );

    await updateGrade(grade.id, "V4+");
    await updateWallAngle(wallAngle.id, 45);

    expect(await db.climbs.get(climb.id)).toMatchObject({
      grade: "V4",
      gradeId: grade.id,
      wallType: "board",
      wallBoardId: board.id,
      wallLabel: "Kilter Board",
      wallAnglePresetId: wallAngle.id,
      wallAngle: 40,
    });
  });

  it("creates an attempt only when session and climb belong together", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const sessionA = await createSession();
    const climbA = await createClimb(sessionA.id, "2Q", "A");

    const attempt = await createAttempt(sessionA.id, climbA.id, "fail");
    expect(attempt.sessionId).toBe(sessionA.id);
    expect(attempt.climbId).toBe(climbA.id);

    setNow("2026-08-17T09:01:00.000Z");
    const sessionB = await createSession();
    const climbB = await createClimb(sessionB.id, "3Q", "B");

    await expect(createAttempt(sessionA.id, climbB.id, "fail")).rejects.toThrow(
      "Attempt session and climb session do not match.",
    );
    await expect(createAttempt(sessionA.id, "missing-climb", "fail")).rejects.toThrow(
      "Cannot create an attempt for a missing climb.",
    );
    await expect(createAttempt("missing-session", climbA.id, "fail")).rejects.toThrow(
      "Cannot create an attempt for a missing session.",
    );
  });

  it("creates hot-path attempts from already loaded session and climb without changing data semantics", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");

    const attempt = await createAttemptForLoadedSessionClimb(session, climb, "send");

    expect(attempt).toMatchObject({
      sessionId: session.id,
      climbId: climb.id,
      result: "send",
      timestamp: "2026-08-17T09:00:00.000Z",
      createdAt: "2026-08-17T09:00:00.000Z",
    });

    await expect(
      createAttemptForLoadedSessionClimb(
        { ...session, id: "other-session" },
        climb,
        "fail",
      ),
    ).rejects.toThrow("Attempt session and climb session do not match.");
    await expect(
      createAttemptForLoadedSessionClimb({ ...session, endedAt: "2026-08-17T09:10:00.000Z" }, climb, "fail"),
    ).rejects.toThrow("Cannot create an attempt for an ended session.");
  });

  it("runs the START to FAIL/SEND attempt state machine", async () => {
    setNow("2026-08-17T18:00:00.000Z");
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");

    const first = await startAttempt(session.id, climb.id);
    expect(first).toMatchObject({
      sessionId: session.id,
      climbId: climb.id,
      startedAt: "2026-08-17T18:00:00.000Z",
      endedAt: null,
      result: null,
    });
    expect((await getActiveAttempt(session.id))?.id).toBe(first.id);

    setNow("2026-08-17T18:00:45.000Z");
    await finishAttempt(first.id, "fail");
    expect(await db.attempts.get(first.id)).toMatchObject({
      startedAt: "2026-08-17T18:00:00.000Z",
      endedAt: "2026-08-17T18:00:45.000Z",
      timestamp: "2026-08-17T18:00:45.000Z",
      result: "fail",
    });
    expect(await getActiveAttempt(session.id)).toBeNull();

    setNow("2026-08-17T18:05:00.000Z");
    const second = await startAttempt(session.id, climb.id);
    setNow("2026-08-17T18:05:30.000Z");
    await finishAttempt(second.id, "send");

    expect(await db.attempts.get(second.id)).toMatchObject({
      startedAt: "2026-08-17T18:05:00.000Z",
      endedAt: "2026-08-17T18:05:30.000Z",
      result: "send",
    });
  });

  it("allows only one active attempt, supports cancel, and blocks session end while active", async () => {
    setNow("2026-08-17T18:00:00.000Z");
    const session = await createSession();
    const climbA = await createClimb(session.id, "2Q", "A");
    const climbB = await createClimb(session.id, "3Q", "B");

    const active = await startAttempt(session.id, climbA.id);
    await expect(startAttempt(session.id, climbB.id)).rejects.toThrow("Finish or cancel the active attempt first.");
    await expect(endSession(session.id)).rejects.toThrow("Finish or cancel the active attempt first.");

    await cancelAttempt(active.id);
    expect(await db.attempts.get(active.id)).toBeUndefined();
    expect(await getActiveAttempt(session.id)).toBeNull();

    await expect(startAttempt(session.id, climbB.id)).resolves.toMatchObject({ climbId: climbB.id });
  });

  it("stores optional effort values, supports clearing them, and rejects out-of-range effort", async () => {
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");

    const attempts = [];
    for (let effort = 1; effort <= 7; effort += 1) {
      const attempt = await createAttempt(session.id, climb.id, "fail");
      await updateAttemptEffort(attempt.id, effort as 1 | 2 | 3 | 4 | 5 | 6 | 7, `note ${effort}`);
      attempts.push(attempt);
    }

    await expect(updateAttemptEffort(attempts[0].id, 8 as 1)).rejects.toThrow(
      "Attempt effort must be between 1 and 7.",
    );
    expect((await db.attempts.get(attempts[0].id))?.effort).toBe(1);
    expect((await db.attempts.get(attempts[0].id))?.note).toBe("note 1");
    expect((await db.attempts.get(attempts[6].id))?.effort).toBe(7);

    await updateAttemptEffort(attempts[0].id, null, null);
    const clearedAttempt = await db.attempts.get(attempts[0].id);
    expect(clearedAttempt?.effort).toBeUndefined();
    expect(clearedAttempt?.note).toBeNull();

    const unsetAttempt = await createAttempt(session.id, climb.id, "send");
    expect(unsetAttempt.effort).toBeUndefined();
  });

  it("updates attempts only to climbs in the same session", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const sessionA = await createSession();
    const climbA = await createClimb(sessionA.id, "2Q", "A");
    const climbA2 = await createClimb(sessionA.id, "1Q", "A2");
    const attempt = await createAttempt(sessionA.id, climbA.id, "fail");

    setNow("2026-08-17T09:02:00.000Z");
    await updateAttempt(attempt.id, {
      result: "send",
      climbId: climbA2.id,
      timestamp: "2026-08-17T09:01:00.000Z",
    });

    const updated = await db.attempts.get(attempt.id);
    expect(updated?.result).toBe("send");
    expect(updated?.climbId).toBe(climbA2.id);

    const sessionB = await createSession();
    const climbB = await createClimb(sessionB.id, "4Q", "B");

    await expect(
      updateAttempt(attempt.id, {
        result: "send",
        climbId: climbB.id,
        timestamp: "2026-08-17T09:01:00.000Z",
      }),
    ).rejects.toThrow("Attempt cannot be moved to a climb in another session.");
  });

  it("validates attempt timestamps against active and ended session ranges", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const activeSession = await createSession();
    const activeClimb = await createClimb(activeSession.id, "2Q", "A");
    const activeAttempt = await createAttempt(activeSession.id, activeClimb.id, "fail");

    setNow("2026-08-17T09:10:00.000Z");
    await expect(
      updateAttempt(activeAttempt.id, {
        result: "fail",
        climbId: activeClimb.id,
        timestamp: "2026-08-17T09:05:00.000Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: activeAttempt.id,
        endedAt: "2026-08-17T09:05:00.000Z",
      }),
    );

    await expect(
      updateAttempt(activeAttempt.id, {
        result: "fail",
        climbId: activeClimb.id,
        timestamp: "2026-08-17T09:11:00.000Z",
      }),
    ).rejects.toThrow("Attempt time must stay within the session range.");

    const endedSession: Session = {
      id: "ended-session",
      startedAt: "2026-08-17T18:00:00.000Z",
      endedAt: "2026-08-17T20:00:00.000Z",
      createdAt: "2026-08-17T18:00:00.000Z",
    };
    await insertSession(endedSession);
    await insertClimb({
      id: "ended-climb",
      sessionId: endedSession.id,
      grade: "3Q",
      name: null,
      createdAt: endedSession.startedAt,
    });
    await db.attempts.add({
      id: "ended-attempt",
      sessionId: endedSession.id,
      climbId: "ended-climb",
      timestamp: "2026-08-17T18:30:00.000Z",
      startedAt: null,
      endedAt: "2026-08-17T18:30:00.000Z",
      result: "fail",
      createdAt: "2026-08-17T18:30:00.000Z",
    });

    await expect(
      updateAttempt("ended-attempt", {
        result: "fail",
        climbId: "ended-climb",
        timestamp: "2026-08-17T17:59:00.000Z",
      }),
    ).rejects.toThrow("Attempt time must stay within the session range.");
    await expect(
      updateAttempt("ended-attempt", {
        result: "fail",
        climbId: "ended-climb",
        timestamp: "2026-08-17T20:01:00.000Z",
      }),
    ).rejects.toThrow("Attempt time must stay within the session range.");

    const overnightSession: Session = {
      id: "overnight-session",
      startedAt: "2026-08-17T23:30:00.000Z",
      endedAt: "2026-08-18T01:10:00.000Z",
      createdAt: "2026-08-17T23:30:00.000Z",
    };
    await insertSession(overnightSession);
    await insertClimb({
      id: "overnight-climb",
      sessionId: overnightSession.id,
      grade: "2Q",
      name: null,
      createdAt: overnightSession.startedAt,
    });
    await db.attempts.add({
      id: "overnight-attempt",
      sessionId: overnightSession.id,
      climbId: "overnight-climb",
      timestamp: "2026-08-18T00:10:00.000Z",
      startedAt: null,
      endedAt: "2026-08-18T00:10:00.000Z",
      result: "fail",
      createdAt: "2026-08-18T00:10:00.000Z",
    });

    await expect(
      updateAttempt("overnight-attempt", {
        result: "send",
        climbId: "overnight-climb",
        timestamp: "2026-08-18T00:20:00.000Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "overnight-attempt",
        result: "send",
        endedAt: "2026-08-18T00:20:00.000Z",
      }),
    );
  });

  it("keeps createdAt stable and writes updatedAt when an attempt is edited", async () => {
    setNow("2026-08-17T18:00:00.000Z");
    const session = await createSession();

    setNow("2026-08-17T18:23:15.000Z");
    const climb = await createClimb(session.id, "2Q", "A");
    const attempt = await createAttempt(session.id, climb.id, "fail");

    expect(attempt.timestamp).toBe("2026-08-17T18:23:15.000Z");
    expect(attempt.createdAt).toBe("2026-08-17T18:23:15.000Z");

    setNow("2026-08-17T18:23:40.000Z");
    await updateAttempt(attempt.id, {
      result: "fail",
      climbId: climb.id,
      timestamp: "2026-08-17T18:20:00.000Z",
      effort: 5,
    });

    const updated = await db.attempts.get(attempt.id);
    expect(updated?.timestamp).toBe("2026-08-17T18:20:00.000Z");
    expect(updated?.createdAt).toBe("2026-08-17T18:23:15.000Z");
    expect(updated?.updatedAt).toBe("2026-08-17T18:23:40.000Z");
    expect(updated?.effort).toBe(5);

    await updateAttempt(attempt.id, {
      result: "fail",
      climbId: climb.id,
      timestamp: "2026-08-17T18:20:00.000Z",
      effort: null,
    });
    expect((await db.attempts.get(attempt.id))?.effort).toBeUndefined();
  });

  it("stores optional wall angle and updates it when a climb is edited", async () => {
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A", null, null, 120, null, "gym", null, "Right hand crux");
    const noAngleClimb = await createClimb(session.id, "3Q", "B");

    expect((await db.climbs.get(climb.id))?.wallAngle).toBe(120);
    expect((await db.climbs.get(climb.id))?.memo).toBe("Right hand crux");
    expect((await db.climbs.get(noAngleClimb.id))?.wallAngle).toBeUndefined();
    expect((await db.climbs.get(noAngleClimb.id))?.memo).toBeNull();

    await updateClimb(climb.id, "2Q", "Renamed", null, null, 110, null, "gym", null, "Use left foot");
    expect(await db.climbs.get(climb.id)).toMatchObject({
      name: "Renamed",
      wallAngle: 110,
      memo: "Use left foot",
    });

    await updateClimb(climb.id, "2Q", "Flat", null, null, null, null, "gym", null, null);
    const cleared = await db.climbs.get(climb.id);
    expect(cleared?.wallAngle).toBeUndefined();
    expect(cleared?.memo).toBeNull();
  });

  it("keeps an active attempt attached to the same climb when the climb identity is corrected", async () => {
    const gym = await createGym("BETA");
    const grade = await createGrade(gym.id, "2Q");
    const angle = await createWallAngle(gym.id, 120);
    const session = await createSession(gym.id);
    const climb = await createClimb(session.id, grade.label, "Yellow", gym.id, grade.id, null, null);
    const attempt = await startAttempt(session.id, climb.id);

    await updateClimb(climb.id, grade.label, "Yellow #12", gym.id, grade.id, angle.angle, angle.id);

    expect(await db.climbs.get(climb.id)).toMatchObject({
      id: climb.id,
      name: "Yellow #12",
      wallAngle: 120,
      wallAnglePresetId: angle.id,
    });
    expect(await db.attempts.get(attempt.id)).toMatchObject({
      id: attempt.id,
      climbId: climb.id,
      endedAt: null,
      result: null,
    });
  });

  it("starts, updates, finishes, and annotates strength sets", async () => {
    const session = await createSession();
    const set = await startStrengthSet(session.id, { name: "Weighted Pull-up", weight: 10, reps: 5, workDurationSeconds: null });

    expect(set).toMatchObject({
      sessionId: session.id,
      name: "Weighted Pull-up",
      weight: 10,
      reps: 5,
      endedAt: null,
    });
    expect((await getActiveStrengthSet(session.id))?.id).toBe(set.id);

    const updated = await updateStrengthSet(set.id, { weight: 12.5, reps: 4, workDurationSeconds: 20 });
    expect(updated).toMatchObject({ id: set.id, weight: 12.5, reps: 4, workDurationSeconds: 20 });

    const finished = await finishStrengthSet(set.id);
    expect(finished.endedAt).toBeTruthy();
    expect(await getActiveStrengthSet(session.id)).toBeNull();

    const annotated = await updateStrengthSetMetadata(set.id, 6, "Solid set");
    expect(annotated).toMatchObject({ effort: 6, memo: "Solid set" });
  });

  it("cancels active strength sets", async () => {
    const session = await createSession();
    const set = await startStrengthSet(session.id, { name: "Front Lever" });

    await cancelStrengthSet(set.id);

    expect(await db.strengthSets.get(set.id)).toBeUndefined();
  });

  it("prevents simultaneous active attempts and strength sets", async () => {
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");
    const activeAttempt = await startAttempt(session.id, climb.id);

    await expect(startStrengthSet(session.id, { name: "Weighted Pull-up" })).rejects.toThrow("Finish or cancel the active attempt first.");
    await finishAttempt(activeAttempt.id, "fail");

    const activeSet = await startStrengthSet(session.id, { name: "Weighted Pull-up" });
    await expect(startAttempt(session.id, climb.id)).rejects.toThrow("Finish or cancel the active strength set first.");
    await finishStrengthSet(activeSet.id);
  });

  it("deletes only the target attempt and derived values recalculate from remaining raw attempts", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");
    const first = await createAttempt(session.id, climb.id, "fail");
    setNow("2026-08-17T09:01:00.000Z");
    const second = await createAttempt(session.id, climb.id, "send");
    setNow("2026-08-17T09:02:00.000Z");
    const third = await createAttempt(session.id, climb.id, "fail");

    await deleteAttempt(second.id);

    expect(await db.sessions.get(session.id)).toBeTruthy();
    expect(await db.climbs.get(climb.id)).toBeTruthy();
    expect(await db.attempts.get(second.id)).toBeUndefined();

    const attempts = await getSessionAttempts(session.id);
    expect(attempts.map((attempt) => attempt.id)).toEqual([first.id, third.id]);
    expect(getAttemptCount(attempts)).toBe(2);
    expect(getSendCount(attempts)).toBe(0);
    expect(getFailCount(attempts)).toBe(2);
    expect(sortAttemptsByTimestampDesc(attempts).map((attempt) => attempt.id)).toEqual([third.id, first.id]);
  });

  it("deletes a session with its climbs and attempts in one cascade", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const session = await createSession();
    const climbA = await createClimb(session.id, "2Q", "A");
    const climbB = await createClimb(session.id, "3Q", "B");
    const first = await createAttempt(session.id, climbA.id, "fail");
    const second = await createAttempt(session.id, climbB.id, "send");

    setNow("2026-08-17T10:00:00.000Z");
    const otherSession = await createSession();
    const otherClimb = await createClimb(otherSession.id, "4Q", "Other");
    const otherAttempt = await createAttempt(otherSession.id, otherClimb.id, "fail");

    await deleteSession(session.id);

    expect(await db.sessions.get(session.id)).toBeUndefined();
    expect(await db.climbs.get(climbA.id)).toBeUndefined();
    expect(await db.climbs.get(climbB.id)).toBeUndefined();
    expect(await db.attempts.get(first.id)).toBeUndefined();
    expect(await db.attempts.get(second.id)).toBeUndefined();
    expect(await db.sessions.get(otherSession.id)).toBeTruthy();
    expect(await db.climbs.get(otherClimb.id)).toBeTruthy();
    expect(await db.attempts.get(otherAttempt.id)).toBeTruthy();
  });

  it("ends and reopens a session without deleting climbs or attempts", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");
    await createAttempt(session.id, climb.id, "fail");

    setNow("2026-08-17T10:00:00.000Z");
    await endSession(session.id);
    expect((await db.sessions.get(session.id))?.endedAt).toBe("2026-08-17T10:00:00.000Z");
    expect(await getSessionClimbs(session.id)).toHaveLength(1);
    expect(await getSessionAttempts(session.id)).toHaveLength(1);

    setNow("2026-08-17T10:05:00.000Z");
    await reopenSession(session.id);
    expect((await db.sessions.get(session.id))?.endedAt).toBeNull();

    await createAttempt(session.id, climb.id, "send");
    expect(await getSessionAttempts(session.id)).toHaveLength(2);
  });

  it("restores active session data after reopening the IndexedDB connection", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const gym = await createGym("BETA");
    const grade = await createGrade(gym.id, "2Q");
    const session = await createSession(gym.id);
    const climb = await createClimb(session.id, grade.label, "A", gym.id, grade.id, 120);
    const attempt = await createAttempt(session.id, climb.id, "fail");
    await updateAttemptEffort(attempt.id, 4);

    db.close();
    await db.open();

    expect((await getActiveSession())?.id).toBe(session.id);
    expect((await db.gyms.get(gym.id))?.name).toBe("BETA");
    expect((await db.grades.get(grade.id))?.label).toBe("2Q");
    expect((await db.sessions.get(session.id))?.initialGymId).toBe(gym.id);
    expect((await db.climbs.get(climb.id))?.gradeId).toBe(grade.id);
    expect((await db.climbs.get(climb.id))?.wallAngle).toBe(120);
    expect((await db.attempts.get(attempt.id))?.effort).toBe(4);
    expect(await getSessionClimbs(session.id)).toHaveLength(1);
    expect(await getSessionAttempts(session.id)).toHaveLength(1);
  });

  it("loads active session snapshots as a complete working set", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const gym = await createGym("BETA");
    const grade = await createGrade(gym.id, "2Q");
    const wallAngle = await createWallAngle(gym.id, 120);
    const board = await createBoard("Kilter Board");
    const session = await createSession(gym.id);
    const firstClimb = await createClimb(session.id, grade.label, "A", gym.id, grade.id, wallAngle.angle, wallAngle.id);
    setNow("2026-08-17T09:01:00.000Z");
    const secondClimb = await createClimb(session.id, grade.label, "B", gym.id, grade.id, wallAngle.angle, wallAngle.id);
    const attempt = await createAttempt(session.id, firstClimb.id, "fail");

    const snapshot = await loadActiveSessionSnapshot(session.id, firstClimb.id);

    expect(snapshot?.session.id).toBe(session.id);
    expect(snapshot?.gym?.id).toBe(gym.id);
    expect(snapshot?.gyms.map((item) => item.id)).toContain(gym.id);
    expect(snapshot?.boards.map((item) => item.id)).toContain(board.id);
    expect(snapshot?.grades.map((item) => item.id)).toContain(grade.id);
    expect(snapshot?.wallAngles.map((item) => item.id)).toContain(wallAngle.id);
    expect(snapshot?.climbs.map((item) => item.id)).toEqual([firstClimb.id, secondClimb.id]);
    expect(snapshot?.attempts.map((item) => item.id)).toEqual([attempt.id]);
    expect(snapshot?.ui.currentClimbId).toBe(firstClimb.id);
  });

  it("restores the current active session snapshot and falls back to the latest climb", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const session = await createSession();
    const firstClimb = await createClimb(session.id, "2Q", "A");
    setNow("2026-08-17T09:01:00.000Z");
    const secondClimb = await createClimb(session.id, "1Q", "B");

    const snapshot = await loadCurrentActiveSessionSnapshot("missing-climb");

    expect(snapshot?.session.id).toBe(session.id);
    expect(snapshot?.ui.currentClimbId).toBe(secondClimb.id);
    expect(snapshot?.climbs.map((climb) => climb.id)).toEqual([firstClimb.id, secondClimb.id]);
  });

  it("saves, edits, and clears optional session review fields without changing session timing", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const session = await createSession();
    setNow("2026-08-17T11:00:00.000Z");
    await endSession(session.id);
    const endedSession = await db.sessions.get(session.id);

    setNow("2026-08-17T11:05:00.000Z");
    const reviewed = await updateSessionReview(session.id, {
      sessionRpe: 0,
      performance: 1,
      memo: "Heavy warm-up, good finish.",
    });

    expect(reviewed).toMatchObject({
      sessionRpe: 0,
      performance: 1,
      memo: "Heavy warm-up, good finish.",
      updatedAt: "2026-08-17T11:05:00.000Z",
    });
    expect(reviewed.startedAt).toBe(session.startedAt);
    expect(reviewed.endedAt).toBe(endedSession?.endedAt);

    setNow("2026-08-17T11:10:00.000Z");
    const edited = await updateSessionReview(session.id, {
      sessionRpe: 10,
      performance: 5,
      memo: "",
    });
    expect(edited.sessionRpe).toBe(10);
    expect(edited.performance).toBe(5);
    expect(edited.memo).toBeNull();

    const cleared = await updateSessionReview(session.id, {
      sessionRpe: null,
      performance: null,
      memo: null,
    });
    expect(cleared.sessionRpe).toBeNull();
    expect(cleared.performance).toBeNull();
    expect(cleared.memo).toBeNull();
  });

  it("rejects invalid session review values", async () => {
    const session = await createSession();

    await expect(updateSessionReview(session.id, { sessionRpe: -1 })).rejects.toThrow(
      "Session RPE must be an integer between 0 and 10.",
    );
    await expect(updateSessionReview(session.id, { sessionRpe: 11 })).rejects.toThrow(
      "Session RPE must be an integer between 0 and 10.",
    );
    await expect(updateSessionReview(session.id, { sessionRpe: 4.5 })).rejects.toThrow(
      "Session RPE must be an integer between 0 and 10.",
    );
    await expect(updateSessionReview(session.id, { performance: 0 })).rejects.toThrow(
      "Performance must be an integer between 1 and 5.",
    );
    await expect(updateSessionReview(session.id, { performance: 6 })).rejects.toThrow(
      "Performance must be an integer between 1 and 5.",
    );
    await expect(updateSessionReview(session.id, { performance: 2.5 })).rejects.toThrow(
      "Performance must be an integer between 1 and 5.",
    );
  });

  it("exports complete raw data including attempt timestamps and audit fields", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A", null, null, 120, null, "gym", null, "Hold right shoulder low");
    const attempt = await createAttempt(session.id, climb.id, "fail");
    const strengthSet = await startStrengthSet(session.id, { name: "Weighted Pull-up", weight: 10, reps: 5 });
    await finishStrengthSet(strengthSet.id);
    await updateStrengthSetMetadata(strengthSet.id, 6, "Good pull");

    setNow("2026-08-17T09:01:00.000Z");
    await updateAttempt(attempt.id, {
      result: "send",
      climbId: climb.id,
      timestamp: "2026-08-17T09:00:30.000Z",
      effort: 6,
      note: "Right foot slipped",
    });
    await updateSessionReview(session.id, {
      sessionRpe: 7,
      performance: 4,
      memo: "Felt better after the second warm-up climb.",
    });

    const exported = await exportAllData();
    const exportedSession = exported.sessions.find((item) => item.id === session.id);
    const exportedClimb = exported.climbs.find((item) => item.id === climb.id);
    const exportedAttempt = exported.attempts.find((item) => item.id === attempt.id);
    const exportedStrengthSet = exported.strengthSets.find((item) => item.id === strengthSet.id);

    expect(exported.schemaVersion).toBe(12);
    expect(exported.exportedAt).toBe("2026-08-17T09:01:00.000Z");
    expect(exported.gyms).toHaveLength(0);
    expect(exported.boards).toHaveLength(0);
    expect(exported.grades).toHaveLength(0);
    expect(exported.wallAngles).toHaveLength(0);
    expect(exported.sessions).toHaveLength(1);
    expect(exported.climbs).toHaveLength(1);
    expect(exported.attempts).toHaveLength(1);
    expect(exported.strengthSets).toHaveLength(1);
    expect(exportedSession).toMatchObject({
      sessionRpe: 7,
      performance: 4,
      memo: "Felt better after the second warm-up climb.",
    });
    expect(exportedClimb?.wallAngle).toBe(120);
    expect(exportedClimb?.memo).toBe("Hold right shoulder low");
    expect(exportedAttempt).toMatchObject({
      sessionId: session.id,
      climbId: climb.id,
      result: "send",
      timestamp: "2026-08-17T09:00:30.000Z",
      effort: 6,
      note: "Right foot slipped",
      createdAt: "2026-08-17T09:00:00.000Z",
      updatedAt: "2026-08-17T09:01:00.000Z",
    });
    expect(exportedStrengthSet).toMatchObject({
      sessionId: session.id,
      name: "Weighted Pull-up",
      weight: 10,
      reps: 5,
      effort: 6,
      memo: "Good pull",
    });
  });

  it("restores a validated full JSON backup by replacing current local data", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const oldSession = await createSession();
    const oldClimb = await createClimb(oldSession.id, "5Q", "Old");
    await createAttempt(oldSession.id, oldClimb.id, "fail");

    const backup = {
      schemaVersion: 5,
      exportedAt: "2026-08-18T00:00:00.000Z",
      gyms: [
        {
          id: "gym-restored",
          name: "BETA",
          isArchived: false,
          createdAt: "2026-08-17T09:59:00.000Z",
        },
      ],
      grades: [
        {
          id: "grade-restored",
          gymId: "gym-restored",
          label: "2Q",
          order: 0,
          isArchived: false,
          createdAt: "2026-08-17T09:59:30.000Z",
        },
      ],
      wallAngles: [
        {
          id: "angle-restored",
          gymId: "gym-restored",
          angle: 120,
          order: 0,
          createdAt: "2026-08-17T09:59:45.000Z",
        },
      ],
      sessions: [
        {
          id: "session-restored",
          startedAt: "2026-08-17T10:00:00.000Z",
          endedAt: null,
          initialGymId: "gym-restored",
          sessionRpe: 8,
          performance: 4,
          memo: "Restored review",
          createdAt: "2026-08-17T10:00:00.000Z",
        },
      ],
      climbs: [
        {
          id: "climb-restored",
          sessionId: "session-restored",
          grade: "2Q",
          gymId: "gym-restored",
          gradeId: "grade-restored",
          wallAnglePresetId: "angle-restored",
          wallAngle: 120,
          name: "Restored",
          createdAt: "2026-08-17T10:01:00.000Z",
        },
      ],
      attempts: [
        {
          id: "attempt-restored",
          sessionId: "session-restored",
          climbId: "climb-restored",
          timestamp: "2026-08-17T10:02:00.000Z",
          result: "send",
          effort: 5,
          createdAt: "2026-08-17T10:02:00.000Z",
          updatedAt: "2026-08-17T10:03:00.000Z",
        },
      ],
    };

    const restored = await restoreAllData(backup);

    expect(restored.gyms).toHaveLength(1);
    expect(restored.grades).toHaveLength(1);
    expect(restored.wallAngles).toHaveLength(1);
    expect(restored.sessions).toHaveLength(1);
    expect(restored.strengthSets).toHaveLength(0);
    expect(await db.sessions.get(oldSession.id)).toBeUndefined();
    expect(await db.sessions.get("session-restored")).toMatchObject({
      sessionRpe: 8,
      performance: 4,
      memo: "Restored review",
    });
    expect(await db.gyms.get("gym-restored")).toBeTruthy();
    expect(await db.grades.get("grade-restored")).toBeTruthy();
    expect(await db.wallAngles.get("angle-restored")).toMatchObject({
      gymId: "gym-restored",
      angle: 120,
      isArchived: false,
    });
    expect(await db.climbs.get("climb-restored")).toMatchObject({
      gymId: "gym-restored",
      gradeId: "grade-restored",
      wallAnglePresetId: "angle-restored",
      wallAngle: 120,
    });
    expect(await db.attempts.get("attempt-restored")).toMatchObject({
      result: "send",
      effort: 5,
      updatedAt: "2026-08-17T10:03:00.000Z",
    });
  });

  it("rejects invalid restore data before writing it", async () => {
    expect(() => validateDataExport({ schemaVersion: 1, exportedAt: "2026-08-18T00:00:00.000Z" })).toThrow(
      "Unsupported backup schema version.",
    );

    await expect(
      restoreAllData({
        schemaVersion: 2,
        exportedAt: "2026-08-18T00:00:00.000Z",
        sessions: [
          {
            id: "session-a",
            startedAt: "2026-08-17T10:00:00.000Z",
            endedAt: null,
            createdAt: "2026-08-17T10:00:00.000Z",
          },
        ],
        climbs: [],
        attempts: [
          {
            id: "attempt-a",
            sessionId: "session-a",
            climbId: "missing-climb",
            timestamp: "2026-08-17T10:02:00.000Z",
            result: "fail",
            createdAt: "2026-08-17T10:02:00.000Z",
          },
        ],
      }),
    ).rejects.toThrow("Backup contains an attempt for a missing climb.");

    expect(() =>
      validateDataExport({
        schemaVersion: 12,
        exportedAt: "2026-08-18T00:00:00.000Z",
        gyms: [],
        boards: [],
        grades: [],
        wallAngles: [],
        sessions: [
          {
            id: "session-a",
            startedAt: "2026-08-17T10:00:00.000Z",
            endedAt: null,
            sessionRpe: -1,
            createdAt: "2026-08-17T10:00:00.000Z",
          },
        ],
        climbs: [],
        attempts: [],
        strengthSets: [],
      }),
    ).toThrow("Session RPE must be an integer between 0 and 10.");

    expect(() =>
      validateDataExport({
        schemaVersion: 12,
        exportedAt: "2026-08-18T00:00:00.000Z",
        gyms: [],
        boards: [],
        grades: [],
        wallAngles: [],
        sessions: [
          {
            id: "session-a",
            startedAt: "2026-08-17T10:00:00.000Z",
            endedAt: null,
            performance: 6,
            createdAt: "2026-08-17T10:00:00.000Z",
          },
        ],
        climbs: [],
        attempts: [],
        strengthSets: [],
      }),
    ).toThrow("Performance must be an integer between 1 and 5.");
  });

  it("restores legacy schema version 2 backups without guessing gyms or grades", async () => {
    const legacy = validateDataExport({
      schemaVersion: 2,
      exportedAt: "2026-08-18T00:00:00.000Z",
      sessions: [
        {
          id: "legacy-session",
          startedAt: "2026-08-17T10:00:00.000Z",
          endedAt: null,
          createdAt: "2026-08-17T10:00:00.000Z",
        },
      ],
      climbs: [
        {
          id: "legacy-climb",
          sessionId: "legacy-session",
          grade: "2Q",
          name: null,
          createdAt: "2026-08-17T10:01:00.000Z",
        },
      ],
      attempts: [],
    });

    expect(legacy.schemaVersion).toBe(12);
    expect(legacy.gyms).toEqual([]);
    expect(legacy.boards).toEqual([]);
    expect(legacy.grades).toEqual([]);
    expect(legacy.wallAngles).toEqual([]);
    expect(legacy.strengthSets).toEqual([]);
    expect(legacy.sessions[0].initialGymId).toBeNull();
    expect(legacy.sessions[0].sessionRpe).toBeUndefined();
    expect(legacy.sessions[0].performance).toBeUndefined();
    expect(legacy.sessions[0].memo).toBeUndefined();
    expect(legacy.climbs[0]).toMatchObject({ grade: "2Q", gymId: null, gradeId: null, wallAnglePresetId: null });
    expect(legacy.climbs[0].wallAngle).toBeUndefined();
  });

  it("opens schema version 9 and reads old records without updatedAt, gym fields, effort, wall angle, or strength sets", async () => {
    expect(db.verno).toBe(9);

    const oldSession: Session = {
      id: "old-session",
      startedAt: "2026-08-17T09:00:00.000Z",
      endedAt: null,
      createdAt: "2026-08-17T09:00:00.000Z",
    };
    await insertSession(oldSession);

    expect(await db.sessions.get(oldSession.id)).toEqual(oldSession);
  });
});
