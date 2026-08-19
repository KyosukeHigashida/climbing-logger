import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import {
  archiveGrade,
  archiveGym,
  createAttempt,
  createAttemptForLoadedSessionClimb,
  createClimb,
  createGrade,
  createGym,
  createWallAngle,
  createSession,
  deleteAttempt,
  deleteGrade,
  deleteGym,
  deleteSession,
  deleteWallAngle,
  endSession,
  exportAllData,
  getActiveSession,
  getGymGrades,
  getGymWallAngles,
  getSessionAttempts,
  getSessionClimbs,
  moveGrade,
  reorderGrades,
  replaceGymGrades,
  replaceGymWallAngles,
  reopenSession,
  restoreAllData,
  updateAttempt,
  updateAttemptEffort,
  updateClimb,
  updateGrade,
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

  it("stores optional effort values, supports clearing them, and rejects out-of-range effort", async () => {
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");

    const attempts = [];
    for (let effort = 1; effort <= 7; effort += 1) {
      const attempt = await createAttempt(session.id, climb.id, "fail");
      await updateAttemptEffort(attempt.id, effort as 1 | 2 | 3 | 4 | 5 | 6 | 7);
      attempts.push(attempt);
    }

    await expect(updateAttemptEffort(attempts[0].id, 8 as 1)).rejects.toThrow(
      "Attempt effort must be between 1 and 7.",
    );
    expect((await db.attempts.get(attempts[0].id))?.effort).toBe(1);
    expect((await db.attempts.get(attempts[6].id))?.effort).toBe(7);

    await updateAttemptEffort(attempts[0].id, null);
    expect((await db.attempts.get(attempts[0].id))?.effort).toBeUndefined();

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
    ).resolves.toBeUndefined();

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
      result: "fail",
      createdAt: "2026-08-18T00:10:00.000Z",
    });

    await expect(
      updateAttempt("overnight-attempt", {
        result: "send",
        climbId: "overnight-climb",
        timestamp: "2026-08-18T00:20:00.000Z",
      }),
    ).resolves.toBeUndefined();
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
    const climb = await createClimb(session.id, "2Q", "A", null, null, 120);
    const noAngleClimb = await createClimb(session.id, "3Q", "B");

    expect((await db.climbs.get(climb.id))?.wallAngle).toBe(120);
    expect((await db.climbs.get(noAngleClimb.id))?.wallAngle).toBeUndefined();

    await updateClimb(climb.id, "2Q", "Renamed", null, null, 110);
    expect(await db.climbs.get(climb.id)).toMatchObject({
      name: "Renamed",
      wallAngle: 110,
    });

    await updateClimb(climb.id, "2Q", "Flat", null, null, null);
    expect((await db.climbs.get(climb.id))?.wallAngle).toBeUndefined();
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

  it("exports complete raw data including attempt timestamps and audit fields", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A", null, null, 120);
    const attempt = await createAttempt(session.id, climb.id, "fail");

    setNow("2026-08-17T09:01:00.000Z");
    await updateAttempt(attempt.id, {
      result: "send",
      climbId: climb.id,
      timestamp: "2026-08-17T09:00:30.000Z",
      effort: 6,
    });

    const exported = await exportAllData();
    const exportedClimb = exported.climbs.find((item) => item.id === climb.id);
    const exportedAttempt = exported.attempts.find((item) => item.id === attempt.id);

    expect(exported.schemaVersion).toBe(5);
    expect(exported.exportedAt).toBe("2026-08-17T09:01:00.000Z");
    expect(exported.gyms).toHaveLength(0);
    expect(exported.grades).toHaveLength(0);
    expect(exported.wallAngles).toHaveLength(0);
    expect(exported.sessions).toHaveLength(1);
    expect(exported.climbs).toHaveLength(1);
    expect(exported.attempts).toHaveLength(1);
    expect(exportedClimb?.wallAngle).toBe(120);
    expect(exportedAttempt).toMatchObject({
      sessionId: session.id,
      climbId: climb.id,
      result: "send",
      timestamp: "2026-08-17T09:00:30.000Z",
      effort: 6,
      createdAt: "2026-08-17T09:00:00.000Z",
      updatedAt: "2026-08-17T09:01:00.000Z",
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
    expect(await db.sessions.get(oldSession.id)).toBeUndefined();
    expect(await db.sessions.get("session-restored")).toBeTruthy();
    expect(await db.gyms.get("gym-restored")).toBeTruthy();
    expect(await db.grades.get("grade-restored")).toBeTruthy();
    expect(await db.wallAngles.get("angle-restored")).toMatchObject({
      gymId: "gym-restored",
      angle: 120,
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

    expect(legacy.schemaVersion).toBe(5);
    expect(legacy.gyms).toEqual([]);
    expect(legacy.grades).toEqual([]);
    expect(legacy.wallAngles).toEqual([]);
    expect(legacy.sessions[0].initialGymId).toBeNull();
    expect(legacy.climbs[0]).toMatchObject({ grade: "2Q", gymId: null, gradeId: null, wallAnglePresetId: null });
    expect(legacy.climbs[0].wallAngle).toBeUndefined();
  });

  it("opens schema version 5 and reads old records without updatedAt, gym fields, effort, or wall angle", async () => {
    expect(db.verno).toBe(5);

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
