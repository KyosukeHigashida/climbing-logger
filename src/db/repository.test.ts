import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import {
  createAttempt,
  createAttemptForLoadedSessionClimb,
  createClimb,
  createSession,
  deleteAttempt,
  deleteSession,
  endSession,
  exportAllData,
  getActiveSession,
  getSessionAttempts,
  getSessionClimbs,
  reopenSession,
  restoreAllData,
  updateAttempt,
  validateDataExport,
} from "./repository";
import type { Climb, Session } from "../types/domain";
import { getAttemptCount, getFailCount, getSendCount, sortAttemptsByTimestampDesc } from "../utils/attempts";

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
    });

    const updated = await db.attempts.get(attempt.id);
    expect(updated?.timestamp).toBe("2026-08-17T18:20:00.000Z");
    expect(updated?.createdAt).toBe("2026-08-17T18:23:15.000Z");
    expect(updated?.updatedAt).toBe("2026-08-17T18:23:40.000Z");
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
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");
    await createAttempt(session.id, climb.id, "fail");

    db.close();
    await db.open();

    expect((await getActiveSession())?.id).toBe(session.id);
    expect(await getSessionClimbs(session.id)).toHaveLength(1);
    expect(await getSessionAttempts(session.id)).toHaveLength(1);
  });

  it("exports complete raw data including attempt timestamps and audit fields", async () => {
    setNow("2026-08-17T09:00:00.000Z");
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");
    const attempt = await createAttempt(session.id, climb.id, "fail");

    setNow("2026-08-17T09:01:00.000Z");
    await updateAttempt(attempt.id, {
      result: "send",
      climbId: climb.id,
      timestamp: "2026-08-17T09:00:30.000Z",
    });

    const exported = await exportAllData();
    const exportedAttempt = exported.attempts.find((item) => item.id === attempt.id);

    expect(exported.schemaVersion).toBe(2);
    expect(exported.exportedAt).toBe("2026-08-17T09:01:00.000Z");
    expect(exported.sessions).toHaveLength(1);
    expect(exported.climbs).toHaveLength(1);
    expect(exported.attempts).toHaveLength(1);
    expect(exportedAttempt).toMatchObject({
      sessionId: session.id,
      climbId: climb.id,
      result: "send",
      timestamp: "2026-08-17T09:00:30.000Z",
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
      schemaVersion: 2,
      exportedAt: "2026-08-18T00:00:00.000Z",
      sessions: [
        {
          id: "session-restored",
          startedAt: "2026-08-17T10:00:00.000Z",
          endedAt: null,
          createdAt: "2026-08-17T10:00:00.000Z",
        },
      ],
      climbs: [
        {
          id: "climb-restored",
          sessionId: "session-restored",
          grade: "2Q",
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
          createdAt: "2026-08-17T10:02:00.000Z",
          updatedAt: "2026-08-17T10:03:00.000Z",
        },
      ],
    };

    const restored = await restoreAllData(backup);

    expect(restored.sessions).toHaveLength(1);
    expect(await db.sessions.get(oldSession.id)).toBeUndefined();
    expect(await db.sessions.get("session-restored")).toBeTruthy();
    expect(await db.climbs.get("climb-restored")).toBeTruthy();
    expect(await db.attempts.get("attempt-restored")).toMatchObject({
      result: "send",
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

  it("opens schema version 2 and reads old records without updatedAt", async () => {
    expect(db.verno).toBe(2);

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
