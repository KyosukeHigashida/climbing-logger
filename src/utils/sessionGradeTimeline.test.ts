import { describe, expect, it } from "vitest";
import type { Attempt, Climb, Grade, Session } from "../types/domain";
import { buildSessionGradeTimeline } from "./sessionGradeTimeline";

describe("session grade timeline", () => {
  it("calculates attempt elapsed time from session start using proportional raw milliseconds", () => {
    const timeline = buildSessionGradeTimeline(
      session(),
      [climb("c1", "g2")],
      [
        attempt("a10", "c1", "2026-08-25T10:10:00.000Z"),
        attempt("a60", "c1", "2026-08-25T11:00:00.000Z"),
      ],
      grades(),
    );

    expect(timeline.attempts.map((item) => item.elapsedMs)).toEqual([10 * 60 * 1000, 60 * 60 * 1000]);
  });

  it("orders grades by existing order semantics with larger order higher difficulty", () => {
    const timeline = buildSessionGradeTimeline(
      session(),
      [climb("easy", "g1"), climb("hard", "g3")],
      [attempt("a1", "easy", "2026-08-25T10:01:00.000Z"), attempt("a2", "hard", "2026-08-25T10:02:00.000Z")],
      grades(),
    );

    expect(timeline.grades.map((grade) => grade.label)).toEqual(["4Q", "2Q"]);
    expect(timeline.attempts.map((item) => item.gradeOrder)).toEqual([0, 2]);
  });

  it("excludes training, board climbs, and incomplete attempts", () => {
    const timeline = buildSessionGradeTimeline(
      session(),
      [climb("gym", "g1"), { ...climb("board", "g2"), wallType: "board", wallBoardId: "board-a" }],
      [
        attempt("gym-done", "gym", "2026-08-25T10:01:00.000Z"),
        attempt("board-done", "board", "2026-08-25T10:02:00.000Z"),
        { ...attempt("active", "gym", "2026-08-25T10:03:00.000Z"), endedAt: null, result: null },
      ],
      grades(),
    );

    expect(timeline.attempts.map((item) => item.attemptId)).toEqual(["gym-done"]);
  });

  it("keeps historical climbs when the referenced grade is archived", () => {
    const timeline = buildSessionGradeTimeline(session(), [climb("c1", "archived")], [attempt("a1", "c1", "2026-08-25T10:01:00.000Z")], [
      ...grades(),
      { ...grade("archived", "1Q", 3), isArchived: true },
    ]);

    expect(timeline.attempts[0]).toMatchObject({
      attemptId: "a1",
      gradeLabel: "1Q",
      gradeId: "archived",
      gradeOrder: 3,
    });
  });

  it("falls back to a unique gym grade label only when the order is safe to recover", () => {
    const timeline = buildSessionGradeTimeline(
      session(),
      [{ ...climb("snapshot", null), grade: "3Q", gymId: "gym-a" }],
      [attempt("a1", "snapshot", "2026-08-25T10:01:00.000Z")],
      grades(),
    );

    expect(timeline.attempts[0]).toMatchObject({
      gradeLabel: "3Q",
      gradeId: "g2",
      gradeOrder: 1,
    });
  });

  it("does not guess a grade order when grade data is missing", () => {
    const timeline = buildSessionGradeTimeline(
      session(),
      [{ ...climb("missing", "deleted"), grade: "3Q" }],
      [attempt("a1", "missing", "2026-08-25T10:01:00.000Z")],
      grades(),
    );

    expect(timeline.attempts).toEqual([]);
  });
});

function session(): Session {
  return {
    id: "session",
    startedAt: "2026-08-25T10:00:00.000Z",
    endedAt: "2026-08-25T12:00:00.000Z",
    initialGymId: "gym-a",
    createdAt: "2026-08-25T10:00:00.000Z",
  };
}

function climb(id: string, gradeId: string | null): Climb {
  return {
    id,
    sessionId: "session",
    grade: gradeId === "g1" ? "4Q" : gradeId === "g3" ? "2Q" : "3Q",
    gymId: "gym-a",
    gradeId,
    wallType: "gym",
    wallBoardId: null,
    name: null,
    createdAt: "2026-08-25T10:00:00.000Z",
  };
}

function attempt(id: string, climbId: string, startedAt: string): Attempt {
  return {
    id,
    sessionId: "session",
    climbId,
    startedAt,
    endedAt: new Date(new Date(startedAt).getTime() + 30_000).toISOString(),
    result: "fail",
    createdAt: startedAt,
  };
}

function grades(): Grade[] {
  return [grade("g1", "4Q", 0), grade("g2", "3Q", 1), grade("g3", "2Q", 2)];
}

function grade(id: string, label: string, order: number): Grade {
  return {
    id,
    gymId: "gym-a",
    boardId: null,
    label,
    order,
    isArchived: false,
    createdAt: "2026-08-25T09:00:00.000Z",
  };
}
