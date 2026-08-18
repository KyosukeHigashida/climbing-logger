import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AttemptButtons } from "../components/AttemptButtons";
import { AttemptEditor } from "../components/AttemptEditor";
import { AttemptTimeline } from "../components/AttemptTimeline";
import { ClimbForm } from "../components/ClimbForm";
import { ClimbList } from "../components/ClimbList";
import { RestTimer } from "../components/RestTimer";
import { SessionTimer } from "../components/SessionTimer";
import {
  createAttemptForLoadedSessionClimb,
  createClimb,
  deleteAttempt,
  endSession,
  getSession,
  getSessionAttempts,
  getSessionClimbs,
  updateAttempt,
  updateClimb,
} from "../db/repository";
import type { Attempt, AttemptResult, Climb, Session } from "../types/domain";
import { getAttemptCount } from "../utils/attempts";
import { currentClimbStorageKey } from "../utils/currentClimb";

export function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [currentClimbId, setCurrentClimbId] = useState<string | null>(null);
  const [isAddingClimb, setIsAddingClimb] = useState(false);
  const [editingClimbId, setEditingClimbId] = useState<string | null>(null);
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session = useLiveQuery<Session | null>(
    async () => (sessionId ? getSession(sessionId) : null),
    [sessionId],
  );
  const climbs = useLiveQuery<Climb[]>(
    () => (sessionId ? getSessionClimbs(sessionId) : Promise.resolve([] as Climb[])),
    [sessionId],
  );
  const attempts = useLiveQuery<Attempt[]>(
    () => (sessionId ? getSessionAttempts(sessionId) : Promise.resolve([] as Attempt[])),
    [sessionId],
  );

  const orderedClimbs = useMemo(() => [...(climbs ?? [])].reverse(), [climbs]);

  useEffect(() => {
    if (sessionId && !currentClimbId) {
      const storedClimbId = localStorage.getItem(currentClimbStorageKey(sessionId));
      if (storedClimbId && orderedClimbs.some((climb) => climb.id === storedClimbId)) {
        setCurrentClimbId(storedClimbId);
        return;
      }
    }
    if (!currentClimbId && orderedClimbs.length > 0) {
      setCurrentClimbId(orderedClimbs[0].id);
    }
    if (currentClimbId && orderedClimbs.length > 0 && !orderedClimbs.some((climb) => climb.id === currentClimbId)) {
      setCurrentClimbId(orderedClimbs[0].id);
    }
  }, [currentClimbId, orderedClimbs, sessionId]);

  useEffect(() => {
    if (sessionId && currentClimbId) {
      localStorage.setItem(currentClimbStorageKey(sessionId), currentClimbId);
    }
  }, [currentClimbId, sessionId]);

  if (session === undefined || !climbs || !attempts) {
    return <main className="app-shell loading">Loading session...</main>;
  }

  if (!sessionId || session === null) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Session not found</h1>
          <p className="muted">This session URL does not match saved data.</p>
          <Link className="primary link-button" to="/">
            Back Home
          </Link>
        </section>
      </main>
    );
  }

  if (session.endedAt) {
    return <NavigateToSummary sessionId={session.id} />;
  }

  const activeSession = session;
  const currentClimb = climbs.find((climb) => climb.id === currentClimbId) ?? null;
  const editingClimb = climbs.find((climb) => climb.id === editingClimbId) ?? null;
  const editingAttempt = attempts.find((attempt) => attempt.id === editingAttemptId) ?? null;
  const lastSessionAttempt = attempts.at(-1) ?? null;

  async function handleAddClimb(grade: string, name: string | null) {
    if (!sessionId) {
      return;
    }
    const climb = await createClimb(sessionId, grade, name);
    setCurrentClimbId(climb.id);
    setIsAddingClimb(false);
  }

  async function handleEditClimb(grade: string, name: string | null) {
    if (!editingClimbId) {
      return;
    }
    await updateClimb(editingClimbId, grade, name);
    setEditingClimbId(null);
  }

  async function handleAttempt(result: AttemptResult) {
    if (!sessionId || !currentClimb) {
      return;
    }
    setError(null);
    try {
      await createAttemptForLoadedSessionClimb(activeSession, currentClimb, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attempt.");
    }
  }

  async function handleEndSession() {
    if (!sessionId || !window.confirm("End this session?")) {
      return;
    }
    setError(null);
    try {
      await endSession(sessionId);
      navigate(`/session/${sessionId}/summary`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end session.");
    }
  }

  return (
    <main className="app-shell">
      <header className="session-header">
        <div>
          <p className="eyebrow">Session</p>
          <h1>
            <SessionTimer startedAt={session.startedAt} />
          </h1>
        </div>
        <Link to="/" className="ghost-link">
          Home
        </Link>
      </header>

      <section className="panel current-climb">
        <p className="label">Current Climb</p>
        {currentClimb ? (
          <>
            <div className="grade-display">{currentClimb.grade}</div>
            <div className="climb-name">{currentClimb.name ?? "Unnamed climb"}</div>
            <div className="metrics-grid">
              <div>
                <span className="metric-label">Attempts</span>
                <strong>{getAttemptCount(attempts, currentClimb.id)}</strong>
              </div>
              <div>
                <span className="metric-label">Rest</span>
                <strong>
                  <RestTimer lastAttemptAt={lastSessionAttempt?.timestamp ?? null} />
                </strong>
              </div>
            </div>
            <AttemptButtons onAttempt={handleAttempt} />
          </>
        ) : (
          <button className="primary full" onClick={() => setIsAddingClimb(true)}>
            + ADD CLIMB
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      {isAddingClimb && (
        <ClimbForm
          onCancel={() => setIsAddingClimb(false)}
          onSubmit={handleAddClimb}
          submitLabel="START CLIMB"
        />
      )}

      {editingClimb && (
        <ClimbForm
          key={editingClimb.id}
          initialGrade={editingClimb.grade}
          initialName={editingClimb.name}
          onCancel={() => setEditingClimbId(null)}
          onSubmit={handleEditClimb}
          submitLabel="SAVE CLIMB"
        />
      )}

      <ClimbList
        climbs={orderedClimbs}
        attempts={attempts}
        currentClimbId={currentClimbId}
        onSelect={setCurrentClimbId}
        onAdd={() => {
          setEditingClimbId(null);
          setIsAddingClimb(true);
        }}
        onEdit={(climb) => {
          setIsAddingClimb(false);
          setEditingClimbId(climb.id);
        }}
      />

      {editingAttempt && (
        <AttemptEditor
          key={editingAttempt.id}
          attempt={editingAttempt}
          climbs={climbs}
          sessionStartedAt={session.startedAt}
          sessionEndedAt={session.endedAt}
          onCancel={() => setEditingAttemptId(null)}
          onDelete={deleteAttempt}
          onSave={updateAttempt}
        />
      )}

      <AttemptTimeline attempts={attempts} climbs={climbs} onEdit={(attempt) => setEditingAttemptId(attempt.id)} />

      <button className="danger full end-button" onClick={handleEndSession}>
        END SESSION
      </button>
    </main>
  );
}

function NavigateToSummary({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/session/${sessionId}/summary`, { replace: true });
  }, [navigate, sessionId]);
  return <main className="app-shell loading">Opening summary...</main>;
}
