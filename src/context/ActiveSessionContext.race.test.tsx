import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveSessionSnapshot } from "../db/repository";
import { ActiveSessionProvider, useActiveSession } from "./ActiveSessionContext";

const repositoryMocks = vi.hoisted(() => ({
  loadActiveSessionSnapshot: vi.fn(),
  loadCurrentActiveSessionSnapshot: vi.fn(),
}));

vi.mock("../db/repository", () => repositoryMocks);

beforeEach(() => {
  repositoryMocks.loadActiveSessionSnapshot.mockReset();
  repositoryMocks.loadCurrentActiveSessionSnapshot.mockReset();
  repositoryMocks.loadCurrentActiveSessionSnapshot.mockResolvedValue(null);
});

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveSessionProvider>{children}</ActiveSessionProvider>;
}

describe("ActiveSessionProvider refresh ordering", () => {
  it("keeps the later refreshSession result when an older refresh resolves last", async () => {
    const old = deferredSnapshot("old");
    repositoryMocks.loadActiveSessionSnapshot
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(Promise.resolve(snapshot("new")));

    const { result } = renderHook(() => useActiveSession(), { wrapper });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    let oldRefresh!: Promise<ActiveSessionSnapshot | null>;
    let newRefresh!: Promise<ActiveSessionSnapshot | null>;
    await act(async () => {
      oldRefresh = result.current.refreshSession("old");
      newRefresh = result.current.refreshSession("new");
      await newRefresh;
    });

    expect(result.current.snapshot?.session.id).toBe("new");

    await act(async () => {
      old.resolve(snapshot("old"));
      await oldRefresh;
    });

    expect(result.current.snapshot?.session.id).toBe("new");
  });

  it("uses one latest-wins sequence across refreshSession and refreshCurrentActiveSession", async () => {
    const old = deferredSnapshot("old");
    repositoryMocks.loadActiveSessionSnapshot.mockReturnValueOnce(old.promise);
    repositoryMocks.loadCurrentActiveSessionSnapshot.mockResolvedValueOnce(null).mockResolvedValueOnce(snapshot("current"));

    const { result } = renderHook(() => useActiveSession(), { wrapper });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    let oldRefresh!: Promise<ActiveSessionSnapshot | null>;
    await act(async () => {
      oldRefresh = result.current.refreshSession("old");
      await result.current.refreshCurrentActiveSession();
    });

    expect(result.current.snapshot?.session.id).toBe("current");

    await act(async () => {
      old.resolve(snapshot("old"));
      await oldRefresh;
    });

    expect(result.current.snapshot?.session.id).toBe("current");
  });

  it("does not let delayed initial hydrate overwrite a later explicit refresh", async () => {
    const hydrate = deferredSnapshot("hydrate");
    repositoryMocks.loadCurrentActiveSessionSnapshot.mockReturnValueOnce(hydrate.promise);
    repositoryMocks.loadActiveSessionSnapshot.mockResolvedValueOnce(snapshot("explicit"));

    const { result } = renderHook(() => useActiveSession(), { wrapper });
    await waitFor(() => expect(repositoryMocks.loadCurrentActiveSessionSnapshot).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.refreshSession("explicit");
    });
    expect(result.current.snapshot?.session.id).toBe("explicit");

    await act(async () => {
      hydrate.resolve(snapshot("hydrate"));
      await hydrate.promise;
    });

    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    expect(result.current.snapshot?.session.id).toBe("explicit");
  });
});

function deferredSnapshot(_id: string) {
  let resolve!: (snapshot: ActiveSessionSnapshot | null) => void;
  const promise = new Promise<ActiveSessionSnapshot | null>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function snapshot(id: string): ActiveSessionSnapshot {
  return {
    session: {
      id,
      startedAt: "2026-08-25T10:00:00.000Z",
      endedAt: null,
      initialGymId: null,
      createdAt: "2026-08-25T10:00:00.000Z",
    },
    climbs: [],
    attempts: [],
    strengthSets: [],
    gym: null,
    gyms: [],
    boards: [],
    grades: [],
    wallAngles: [],
    ui: {
      currentClimbId: null,
      currentWallType: "gym",
      currentBoardId: null,
      currentActivityType: "climb",
    },
  };
}
