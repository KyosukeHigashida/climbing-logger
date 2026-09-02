import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Attempt, Board, Climb, Grade, Session } from "../types/domain";
import { getInitialGradeTimelineWallValue, SessionGradeTimeline } from "./SessionGradeTimeline";

describe("SessionGradeTimeline initial wall selection", () => {
  it("starts on Gym Wall when gym attempts are displayable", () => {
    expect(getInitialGradeTimelineWallValue(session(), [gymClimb("gym", "g1")], [attempt("a1", "gym", "2026-08-25T10:01:00.000Z")], grades())).toBe(
      "gym",
    );
  });

  it("starts on the active board when there are no gym attempts", () => {
    expect(
      getInitialGradeTimelineWallValue(
        session(),
        [boardClimb("board-a-climb", "b1", "board-a")],
        [attempt("a1", "board-a-climb", "2026-08-25T10:01:00.000Z")],
        [...grades(), boardGrade("b1", "V0", 0, "board-a")],
      ),
    ).toBe("board:board-a");
  });

  it("starts on the board with the first displayable activity when multiple boards exist", () => {
    expect(
      getInitialGradeTimelineWallValue(
        session(),
        [boardClimb("board-a-climb", "a1", "board-a"), boardClimb("board-b-climb", "b1", "board-b")],
        [attempt("later", "board-a-climb", "2026-08-25T10:20:00.000Z"), attempt("earlier", "board-b-climb", "2026-08-25T10:10:00.000Z")],
        [boardGrade("a1", "V0", 0, "board-a"), boardGrade("b1", "V0", 0, "board-b")],
      ),
    ).toBe("board:board-b");
  });

  it("starts on Gym Wall when there are no displayable attempts", () => {
    expect(getInitialGradeTimelineWallValue(session(), [gymClimb("gym", "g1")], [], grades())).toBe("gym");
  });

  it("does not reset after the user manually changes the wall", () => {
    const props = {
      session: session(),
      climbs: [boardClimb("board-a-climb", "b1", "board-a")],
      attempts: [attempt("a1", "board-a-climb", "2026-08-25T10:01:00.000Z")],
      grades: [...grades(), boardGrade("b1", "V0", 0, "board-a"), boardGrade("b2", "V0", 0, "board-b")],
      boards: [board("board-a", "Board A"), board("board-b", "Board B")],
    };
    const { rerender } = render(<SessionGradeTimeline {...props} />);
    const select = screen.getByLabelText("Wall");

    expect(select).toHaveValue("board:board-a");
    fireEvent.change(select, { target: { value: "gym" } });
    expect(select).toHaveValue("gym");

    rerender(
      <SessionGradeTimeline
        {...props}
        climbs={[...props.climbs, boardClimb("board-b-climb", "b2", "board-b")]}
        attempts={[...props.attempts, attempt("earlier", "board-b-climb", "2026-08-25T10:00:30.000Z")]}
      />,
    );

    expect(screen.getByLabelText("Wall")).toHaveValue("gym");
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

function gymClimb(id: string, gradeId: string): Climb {
  return {
    id,
    sessionId: "session",
    grade: "3Q",
    gymId: "gym-a",
    gradeId,
    wallType: "gym",
    wallBoardId: null,
    name: null,
    createdAt: "2026-08-25T10:00:00.000Z",
  };
}

function boardClimb(id: string, gradeId: string, boardId: string): Climb {
  return {
    ...gymClimb(id, gradeId),
    grade: "V0",
    gymId: null,
    wallType: "board",
    wallBoardId: boardId,
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
  return [grade("g1", "3Q", 0)];
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

function boardGrade(id: string, label: string, order: number, boardId: string): Grade {
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

function board(id: string, name: string): Board {
  return {
    id,
    name,
    isArchived: false,
    createdAt: "2026-08-25T09:00:00.000Z",
  };
}
