import { describe, expect, it } from "vitest";
import type { Attempt, Climb, Grade, Session } from "../types/domain";
import { buildSessionGradeTimeline, getGradeLevelRatio } from "./sessionGradeTimeline";

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

    expect(timeline.grades.map((grade) => grade.label)).toEqual(["4Q", "3Q", "2Q"]);
    expect(timeline.attempts.map((item) => item.gradeOrder)).toEqual([0, 2]);
  });

  it("keeps the full gym grade scale on the axis even when grades are unused", () => {
    const timeline = buildSessionGradeTimeline(session(), [climb("hard", "g3")], [attempt("a1", "hard", "2026-08-25T10:02:00.000Z")], grades());

    expect(timeline.grades.map((grade) => grade.id)).toEqual(["g1", "g2", "g3"]);
  });

  it("keeps the same gym grade level stable across different sessions", () => {
    const first = buildSessionGradeTimeline(session(), [climb("c1", "g2")], [attempt("a1", "c1", "2026-08-25T10:01:00.000Z")], grades());
    const second = buildSessionGradeTimeline(
      { ...session(), id: "another-session", startedAt: "2026-08-26T10:00:00.000Z", endedAt: "2026-08-26T12:00:00.000Z" },
      [climb("c2", "g2")],
      [attempt("a2", "c2", "2026-08-26T10:30:00.000Z")],
      grades(),
    );

    const firstIndex = first.grades.findIndex((grade) => grade.id === "g2");
    const secondIndex = second.grades.findIndex((grade) => grade.id === "g2");

    expect(first.grades.map((grade) => grade.id)).toEqual(second.grades.map((grade) => grade.id));
    expect(getGradeLevelRatio(firstIndex, first.grades.length)).toBe(getGradeLevelRatio(secondIndex, second.grades.length));
  });

  it("does not give the lowest grade a zero normalized level", () => {
    expect(getGradeLevelRatio(0, 3)).toBe(1 / 3);
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

  it("includes board climbs and fixes the axis to the selected board grade scale", () => {
    const timeline = buildSessionGradeTimeline(
      session(),
      [{ ...climb("board", "b2"), grade: "V1", wallType: "board", wallBoardId: "board-a" }],
      [attempt("board-done", "board", "2026-08-25T10:02:00.000Z")],
      [...grades(), boardGrade("b1", "V0", 0), boardGrade("b2", "V1", 1), boardGrade("b3", "V2", 2)],
      { type: "board", boardId: "board-a" },
    );

    expect(timeline.attempts).toHaveLength(1);
    expect(timeline.attempts[0]).toMatchObject({
      attemptId: "board-done",
      gradeLabel: "V1",
      gradeId: "b2",
      gradeOrder: 1,
    });
    expect(timeline.grades.map((grade) => grade.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("keeps archived board grades on the selected board axis when needed for history", () => {
    const timeline = buildSessionGradeTimeline(
      session(),
      [{ ...climb("board", "archived-board"), grade: "V3", wallType: "board", wallBoardId: "board-a" }],
      [attempt("board-done", "board", "2026-08-25T10:02:00.000Z")],
      [...grades(), boardGrade("b1", "V0", 0), { ...boardGrade("archived-board", "V3", 3), isArchived: true }],
      { type: "board", boardId: "board-a" },
    );

    expect(timeline.attempts[0]).toMatchObject({
      gradeLabel: "V3",
      gradeId: "archived-board",
    });
    expect(timeline.grades.map((grade) => grade.id)).toContain("archived-board");
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
    expect(timeline.grades.map((grade) => grade.id)).toContain("archived");
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

  it("does not mix board grades into the gym wall axis", () => {
    const timeline = buildSessionGradeTimeline(session(), [climb("gym", "g1")], [attempt("a1", "gym", "2026-08-25T10:01:00.000Z")], [
      ...grades(),
      { ...grade("board-grade", "V4", 99), gymId: null, boardId: "board-a" },
    ]);

    expect(timeline.grades.map((grade) => grade.id)).toEqual(["g1", "g2", "g3"]);
  });

  it("does not mix gym or other board grades into the selected board axis", () => {
    const timeline = buildSessionGradeTimeline(
      session(),
      [{ ...climb("board", "b1"), grade: "V0", wallType: "board", wallBoardId: "board-a" }],
      [attempt("board-done", "board", "2026-08-25T10:02:00.000Z")],
      [...grades(), boardGrade("b1", "V0", 0), boardGrade("other-board", "V9", 9, "board-b")],
      { type: "board", boardId: "board-a" },
    );

    expect(timeline.grades.map((grade) => grade.id)).toEqual(["b1"]);
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

function boardGrade(id: string, label: string, order: number, boardId = "board-a"): Grade {
  return {
    id,
    gymId: null,
    boardId,
    label,
    order,
    isArchived: false,
    createdAt: "2026-08-25T09:00:00.000Z",
  };
}
