import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { createClimb, createSession } from "../db/repository";
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
});
