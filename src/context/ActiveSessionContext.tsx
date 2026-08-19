import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadActiveSessionSnapshot,
  loadCurrentActiveSessionSnapshot,
  type ActiveSessionSnapshot,
} from "../db/repository";
import type { Attempt, Climb } from "../types/domain";

type ActiveSessionContextValue = {
  snapshot: ActiveSessionSnapshot | null;
  isHydrating: boolean;
  refreshCurrentActiveSession: () => Promise<ActiveSessionSnapshot | null>;
  refreshSession: (sessionId: string, currentClimbId?: string | null) => Promise<ActiveSessionSnapshot | null>;
  clearSnapshot: () => void;
  setCurrentClimbId: (currentClimbId: string | null) => void;
  upsertClimb: (climb: Climb) => void;
  upsertAttempt: (attempt: Attempt) => void;
  removeAttempt: (attemptId: string) => void;
};

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(null);

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ActiveSessionSnapshot | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const refreshCurrentActiveSession = useCallback(async () => {
    const nextSnapshot = await loadCurrentActiveSessionSnapshot(snapshot?.currentClimbId ?? null);
    setSnapshot(nextSnapshot);
    return nextSnapshot;
  }, [snapshot?.currentClimbId]);

  const refreshSession = useCallback(async (sessionId: string, currentClimbId: string | null = null) => {
    const nextSnapshot = await loadActiveSessionSnapshot(sessionId, currentClimbId);
    setSnapshot(nextSnapshot);
    return nextSnapshot;
  }, []);

  const clearSnapshot = useCallback(() => {
    setSnapshot(null);
  }, []);

  const setCurrentClimbId = useCallback((currentClimbId: string | null) => {
    setSnapshot((current) => {
      if (!current || current.currentClimbId === currentClimbId) {
        return current;
      }
      return { ...current, currentClimbId };
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
      return { ...current, climbs, currentClimbId: climb.id };
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
      upsertClimb,
      upsertAttempt,
      removeAttempt,
    }),
    [
      clearSnapshot,
      isHydrating,
      refreshCurrentActiveSession,
      refreshSession,
      removeAttempt,
      setCurrentClimbId,
      snapshot,
      upsertAttempt,
      upsertClimb,
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
