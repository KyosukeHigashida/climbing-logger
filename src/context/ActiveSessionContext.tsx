import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadActiveSessionSnapshot,
  loadCurrentActiveSessionSnapshot,
  type ActiveSessionSnapshot,
} from "../db/repository";
import type { Attempt, Board, Climb, Grade, WallAngle } from "../types/domain";
import type { SavedWallSelection } from "../utils/currentClimb";

type ActiveSessionContextValue = {
  snapshot: ActiveSessionSnapshot | null;
  isHydrating: boolean;
  refreshCurrentActiveSession: () => Promise<ActiveSessionSnapshot | null>;
  refreshSession: (
    sessionId: string,
    currentClimbId?: string | null,
    wallSelection?: SavedWallSelection | null,
  ) => Promise<ActiveSessionSnapshot | null>;
  clearSnapshot: () => void;
  setCurrentClimbId: (currentClimbId: string | null) => void;
  setCurrentWallSelection: (wallSelection: SavedWallSelection) => void;
  upsertClimb: (climb: Climb) => void;
  upsertAttempt: (attempt: Attempt) => void;
  upsertBoard: (board: Board) => void;
  removeBoard: (boardId: string) => void;
  upsertGrade: (grade: Grade) => void;
  removeGrade: (gradeId: string) => void;
  upsertWallAngle: (wallAngle: WallAngle) => void;
  removeWallAngle: (wallAngleId: string) => void;
  removeAttempt: (attemptId: string) => void;
};

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(null);

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ActiveSessionSnapshot | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const refreshCurrentActiveSession = useCallback(async () => {
    const nextSnapshot = await loadCurrentActiveSessionSnapshot(
      snapshot?.ui.currentClimbId ?? null,
      snapshot?.ui.currentWallType ?? "gym",
      snapshot?.ui.currentBoardId ?? null,
    );
    setSnapshot(nextSnapshot);
    return nextSnapshot;
  }, [snapshot?.ui.currentBoardId, snapshot?.ui.currentClimbId, snapshot?.ui.currentWallType]);

  const refreshSession = useCallback(
    async (sessionId: string, currentClimbId: string | null = null, wallSelection: SavedWallSelection | null = null) => {
      const nextSnapshot = await loadActiveSessionSnapshot(
        sessionId,
        currentClimbId,
        wallSelection?.wallType ?? snapshot?.ui.currentWallType ?? "gym",
        wallSelection?.wallBoardId ?? snapshot?.ui.currentBoardId ?? null,
      );
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    },
    [snapshot?.ui.currentBoardId, snapshot?.ui.currentWallType],
  );

  const clearSnapshot = useCallback(() => {
    setSnapshot(null);
  }, []);

  const setCurrentClimbId = useCallback((currentClimbId: string | null) => {
    setSnapshot((current) => {
      if (!current || current.ui.currentClimbId === currentClimbId) {
        return current;
      }
      return { ...current, ui: { ...current.ui, currentClimbId } };
    });
  }, []);

  const setCurrentWallSelection = useCallback((wallSelection: SavedWallSelection) => {
    setSnapshot((current) => {
      if (
        !current ||
        (current.ui.currentWallType === wallSelection.wallType && current.ui.currentBoardId === wallSelection.wallBoardId)
      ) {
        return current;
      }
      return {
        ...current,
        ui: {
          ...current.ui,
          currentWallType: wallSelection.wallType,
          currentBoardId: wallSelection.wallType === "board" ? wallSelection.wallBoardId : null,
        },
      };
    });
  }, []);

  const upsertClimb = useCallback((climb: Climb) => {
    setSnapshot((current) => {
      if (!current || current.session.id !== climb.sessionId) {
        return current;
      }
      const climbs = current.climbs.some((item) => item.id === climb.id)
        ? current.climbs.map((item) => (item.id === climb.id ? climb : item))
        : [...current.climbs, climb];
      return { ...current, climbs, ui: { ...current.ui, currentClimbId: climb.id } };
    });
  }, []);

  const upsertAttempt = useCallback((attempt: Attempt) => {
    setSnapshot((current) => {
      if (!current || current.session.id !== attempt.sessionId) {
        return current;
      }
      const attempts = current.attempts.some((item) => item.id === attempt.id)
        ? current.attempts.map((item) => (item.id === attempt.id ? attempt : item))
        : [...current.attempts, attempt];
      return { ...current, attempts };
    });
  }, []);

  const removeAttempt = useCallback((attemptId: string) => {
    setSnapshot((current) => (current ? { ...current, attempts: current.attempts.filter((attempt) => attempt.id !== attemptId) } : current));
  }, []);

  const upsertBoard = useCallback((board: Board) => {
    setSnapshot((current) => {
      if (!current) {
        return current;
      }
      const boards = current.boards.some((item) => item.id === board.id)
        ? current.boards.map((item) => (item.id === board.id ? board : item))
        : [...current.boards, board];
      return { ...current, boards };
    });
  }, []);

  const removeBoard = useCallback((boardId: string) => {
    setSnapshot((current) => {
      if (!current || !current.boards.some((board) => board.id === boardId)) {
        return current;
      }
      const boards = current.boards.filter((board) => board.id !== boardId);
      const ui =
        current.ui.currentWallType === "board" && current.ui.currentBoardId === boardId
          ? { ...current.ui, currentWallType: "gym" as const, currentBoardId: null }
          : current.ui;
      return { ...current, boards, ui };
    });
  }, []);

  const upsertGrade = useCallback((grade: Grade) => {
    setSnapshot((current) => {
      if (!current) {
        return current;
      }
      const grades = current.grades.some((item) => item.id === grade.id)
        ? current.grades.map((item) => (item.id === grade.id ? grade : item))
        : [...current.grades, grade];
      return { ...current, grades };
    });
  }, []);

  const removeGrade = useCallback((gradeId: string) => {
    setSnapshot((current) => {
      if (!current || !current.grades.some((grade) => grade.id === gradeId)) {
        return current;
      }
      return { ...current, grades: current.grades.filter((grade) => grade.id !== gradeId) };
    });
  }, []);

  const upsertWallAngle = useCallback((wallAngle: WallAngle) => {
    setSnapshot((current) => {
      if (!current) {
        return current;
      }
      const wallAngles = current.wallAngles.some((item) => item.id === wallAngle.id)
        ? current.wallAngles.map((item) => (item.id === wallAngle.id ? wallAngle : item))
        : [...current.wallAngles, wallAngle];
      return { ...current, wallAngles };
    });
  }, []);

  const removeWallAngle = useCallback((wallAngleId: string) => {
    setSnapshot((current) => {
      if (!current || !current.wallAngles.some((wallAngle) => wallAngle.id === wallAngleId)) {
        return current;
      }
      return { ...current, wallAngles: current.wallAngles.filter((wallAngle) => wallAngle.id !== wallAngleId) };
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function hydrate() {
      try {
        const nextSnapshot = await loadCurrentActiveSessionSnapshot();
        if (isMounted) {
          setSnapshot(nextSnapshot);
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    }

    void hydrate();
    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      snapshot,
      isHydrating,
      refreshCurrentActiveSession,
      refreshSession,
      clearSnapshot,
      setCurrentClimbId,
      setCurrentWallSelection,
      upsertClimb,
      upsertAttempt,
      upsertBoard,
      removeBoard,
      upsertGrade,
      removeGrade,
      upsertWallAngle,
      removeWallAngle,
      removeAttempt,
    }),
    [
      clearSnapshot,
      isHydrating,
      refreshCurrentActiveSession,
      refreshSession,
      removeBoard,
      removeAttempt,
      removeGrade,
      removeWallAngle,
      setCurrentClimbId,
      setCurrentWallSelection,
      snapshot,
      upsertAttempt,
      upsertBoard,
      upsertClimb,
      upsertGrade,
      upsertWallAngle,
    ],
  );

  return <ActiveSessionContext.Provider value={value}>{children}</ActiveSessionContext.Provider>;
}

export function useActiveSession() {
  const context = useContext(ActiveSessionContext);
  if (!context) {
    throw new Error("useActiveSession must be used within ActiveSessionProvider.");
  }
  return context;
}
