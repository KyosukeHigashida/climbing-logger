import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { createBoard, createClimb, createGrade, createGym, createSession, createWallAngle, startAttempt } from "../db/repository";
import { db } from "../db/db";
import { ActiveSessionProvider, useActiveSession } from "./ActiveSessionContext";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveSessionProvider>{children}</ActiveSessionProvider>;
}

describe("ActiveSessionProvider", () => {
  it("hydrates the active session snapshot from IndexedDB on cold start", async () => {
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");

    const { result } = renderHook(() => useActiveSession(), { wrapper });

    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    expect(result.current.snapshot?.session.id).toBe(session.id);
    expect(result.current.snapshot?.ui.currentClimbId).toBe(climb.id);
    expect(result.current.snapshot?.ui.currentActivityType).toBe("climb");
  });

  it("updates and clears the in-memory active session snapshot", async () => {
    const session = await createSession();
    const firstClimb = await createClimb(session.id, "2Q", "A");
    const secondClimb = await createClimb(session.id, "1Q", "B");

    const { result } = renderHook(() => useActiveSession(), { wrapper });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    await act(async () => {
      await result.current.refreshSession(session.id, firstClimb.id);
    });
    expect(result.current.snapshot?.ui.currentClimbId).toBe(firstClimb.id);

    act(() => {
      result.current.setCurrentClimbId(secondClimb.id);
    });
    expect(result.current.snapshot?.ui.currentClimbId).toBe(secondClimb.id);

    act(() => {
      result.current.clearSnapshot();
    });
    expect(result.current.snapshot).toBeNull();
  });

  it("preserves currentActivityType during warm refreshSession", async () => {
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");

    const { result } = renderHook(() => useActiveSession(), { wrapper });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    act(() => {
      result.current.setCurrentActivityType("training");
    });
    expect(result.current.snapshot?.ui.currentActivityType).toBe("training");

    await act(async () => {
      await result.current.refreshSession(session.id, climb.id);
    });
    expect(result.current.snapshot?.ui.currentActivityType).toBe("training");
  });

  it("upserts master board and wall angle records without changing active session state", async () => {
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");
    const attempt = await startAttempt(session.id, climb.id);

    const { result } = renderHook(() => useActiveSession(), { wrapper });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    expect(result.current.snapshot?.session.id).toBe(session.id);

    const gym = await createGym("BETA");
    const board = await createBoard("Kilter Board");
    const wallAngle = await createWallAngle(gym.id, 120);

    act(() => {
      result.current.upsertBoard(board);
      result.current.upsertWallAngle(wallAngle);
    });

    expect(result.current.snapshot?.session.id).toBe(session.id);
    expect(result.current.snapshot?.ui.currentClimbId).toBe(climb.id);
    expect(result.current.snapshot?.attempts.map((item) => item.id)).toEqual([attempt.id]);
    expect(result.current.snapshot?.boards.map((item) => item.id)).toContain(board.id);
    expect(result.current.snapshot?.wallAngles.map((item) => item.id)).toContain(wallAngle.id);

    act(() => {
      result.current.removeWallAngle(wallAngle.id);
    });

    expect(result.current.snapshot?.session.id).toBe(session.id);
    expect(result.current.snapshot?.ui.currentClimbId).toBe(climb.id);
    expect(result.current.snapshot?.attempts.map((item) => item.id)).toEqual([attempt.id]);
    expect(result.current.snapshot?.wallAngles.map((item) => item.id)).not.toContain(wallAngle.id);
  });

  it("upserts and removes master grade records without changing active session state", async () => {
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");
    const attempt = await startAttempt(session.id, climb.id);

    const { result } = renderHook(() => useActiveSession(), { wrapper });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    expect(result.current.snapshot?.session.id).toBe(session.id);

    const gym = await createGym("BETA");
    const grade = await createGrade(gym.id, "1Q");

    act(() => {
      result.current.upsertGrade(grade);
    });

    expect(result.current.snapshot?.session.id).toBe(session.id);
    expect(result.current.snapshot?.ui.currentClimbId).toBe(climb.id);
    expect(result.current.snapshot?.attempts.map((item) => item.id)).toEqual([attempt.id]);
    expect(result.current.snapshot?.grades.map((item) => item.id)).toContain(grade.id);

    act(() => {
      result.current.removeGrade(grade.id);
    });

    expect(result.current.snapshot?.session.id).toBe(session.id);
    expect(result.current.snapshot?.ui.currentClimbId).toBe(climb.id);
    expect(result.current.snapshot?.attempts.map((item) => item.id)).toEqual([attempt.id]);
    expect(result.current.snapshot?.grades.map((item) => item.id)).not.toContain(grade.id);
  });

  it("removes deleted boards from the active snapshot and falls back to the gym wall", async () => {
    const session = await createSession();
    const climb = await createClimb(session.id, "2Q", "A");
    const board = await createBoard("Kilter Board");

    const { result } = renderHook(() => useActiveSession(), { wrapper });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    act(() => {
      result.current.upsertBoard(board);
      result.current.setCurrentWallSelection({ wallType: "board", wallBoardId: board.id });
    });
    expect(result.current.snapshot?.boards.map((item) => item.id)).toContain(board.id);
    expect(result.current.snapshot?.ui.currentWallType).toBe("board");
    expect(result.current.snapshot?.ui.currentBoardId).toBe(board.id);

    act(() => {
      result.current.removeBoard(board.id);
    });

    expect(result.current.snapshot?.session.id).toBe(session.id);
    expect(result.current.snapshot?.ui.currentClimbId).toBe(climb.id);
    expect(result.current.snapshot?.boards.map((item) => item.id)).not.toContain(board.id);
    expect(result.current.snapshot?.ui.currentWallType).toBe("gym");
    expect(result.current.snapshot?.ui.currentBoardId).toBeNull();
  });
});
