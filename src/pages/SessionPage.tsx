import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AttemptButtons } from "../components/AttemptButtons";
import { AttemptEditor } from "../components/AttemptEditor";
import { AttemptTimeline } from "../components/AttemptTimeline";
import { ClimbForm, type ClimbFormValue } from "../components/ClimbForm";
import { ClimbList } from "../components/ClimbList";
import { EffortInput } from "../components/EffortInput";
import { IntervalTimer } from "../components/IntervalTimer";
import { SessionTimer } from "../components/SessionTimer";
import {
  createAttemptForLoadedSessionClimb,
  createClimb,
  deleteAttempt,
  endSession,
  getAllGrades,
  getAllGyms,
  getAllWallAngles,
  getSession,
  getSessionAttempts,
  getSessionClimbs,
  updateAttempt,
  updateAttemptEffort,
  updateClimb,
} from "../db/repository";
import type { Attempt, AttemptEffort, AttemptResult, Climb, Grade, Gym, Session, WallAngle } from "../types/domain";
import { getAttemptCount } from "../utils/attempts";
import { currentClimbStorageKey } from "../utils/currentClimb";
import { getSavedCurrentVenueId, saveCurrentVenueId } from "../utils/currentVenue";
import { getReusableWallAnglePreset } from "../utils/wallAngles";

export function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [currentClimbId, setCurrentClimbId] = useState<string | null>(null);
  const [isAddingClimb, setIsAddingClimb] = useState(false);
  const [editingClimbId, setEditingClimbId] = useState<string | null>(null);
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [currentVenueId, setCurrentVenueId] = useState<string | null>(null);
  const [hasLoadedVenue, setHasLoadedVenue] = useState(false);
  const [pendingEffortAttemptId, setPendingEffortAttemptId] = useState<string | null>(null);
  const [pendingEffort, setPendingEffort] = useState<AttemptEffort>(4);
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
  const gyms = useLiveQuery<Gym[]>(() => getAllGyms(), []);
  const grades = useLiveQuery<Grade[]>(() => getAllGrades(), []);
  const wallAngles = useLiveQuery<WallAngle[]>(() => getAllWallAngles(), []);

  const orderedClimbs = useMemo(() => [...(climbs ?? [])].reverse(), [climbs]);

  useEffect(() => {
    setHasLoadedVenue(false);
    setCurrentVenueId(null);
  }, [sessionId]);

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

  useEffect(() => {
    if (!sessionId || !session || !gyms || hasLoadedVenue) {
      return;
    }
    const storedVenueId = getSavedCurrentVenueId(sessionId);
    const storedVenue = storedVenueId ? gyms.find((gym) => gym.id === storedVenueId) : null;
    const initialVenue = session.initialGymId ? gyms.find((gym) => gym.id === session.initialGymId) : null;
    setCurrentVenueId(storedVenue?.id ?? initialVenue?.id ?? null);
    setHasLoadedVenue(true);
  }, [gyms, hasLoadedVenue, session, sessionId]);

  useEffect(() => {
    if (sessionId && hasLoadedVenue) {
      saveCurrentVenueId(sessionId, currentVenueId);
    }
  }, [currentVenueId, hasLoadedVenue, sessionId]);

  if (session === undefined || !climbs || !attempts || !gyms || !grades || !wallAngles) {
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
  const intervalStartedAt = lastSessionAttempt?.timestamp ?? activeSession.startedAt;
  const currentVenue = currentVenueId ? gyms.find((gym) => gym.id === currentVenueId) ?? null : null;
  const activeGyms = gyms.filter((gym) => !gym.isArchived || gym.id === currentVenueId);
  const currentVenueGrades = grades
    .filter((grade) => grade.gymId === currentVenueId && !grade.isArchived)
    .sort((a, b) => a.order - b.order);
  const editingClimbGrades = editingClimb
    ? grades
        .filter((grade) => grade.gymId === (editingClimb.gymId ?? null) && (!grade.isArchived || grade.id === editingClimb.gradeId))
        .sort((a, b) => a.order - b.order)
    : [];
  const currentVenueWallAngles = wallAngles
    .filter((wallAngle) => wallAngle.gymId === currentVenueId)
    .sort((a, b) => a.order - b.order);
  const initialWallAnglePreset = getReusableWallAnglePreset(climbs, currentVenueId, wallAngles);
  const editingClimbWallAngles = editingClimb
    ? wallAngles
        .filter((wallAngle) => wallAngle.gymId === (editingClimb.gymId ?? null))
        .sort((a, b) => a.order - b.order)
    : [];
  const editingVenue = editingClimb?.gymId ? gyms.find((gym) => gym.id === editingClimb.gymId) ?? null : null;

  async function handleAddClimb(value: ClimbFormValue) {
    if (!sessionId) {
      return;
    }
    const climb = await createClimb(
      sessionId,
      value.grade,
      value.name,
      value.gymId,
      value.gradeId,
      value.wallAngle,
      value.wallAnglePresetId,
    );
    setCurrentClimbId(climb.id);
    setIsAddingClimb(false);
  }

  async function handleEditClimb(value: ClimbFormValue) {
    if (!editingClimbId) {
      return;
    }
    await updateClimb(
      editingClimbId,
      value.grade,
      value.name,
      value.gymId,
      value.gradeId,
      value.wallAngle,
      value.wallAnglePresetId,
    );
    setEditingClimbId(null);
  }

  function handleVenueChange(nextVenueId: string) {
    setCurrentVenueId(nextVenueId || null);
    setIsAddingClimb(false);
  }

  async function handleAttempt(result: AttemptResult) {
    if (!sessionId || !currentClimb) {
      return;
    }
    setError(null);
    try {
      const attempt = await createAttemptForLoadedSessionClimb(activeSession, currentClimb, result);
      setPendingEffortAttemptId(attempt.id);
      setPendingEffort(attempt.effort ?? 4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attempt.");
    }
  }

  async function handleSavePendingEffort() {
    if (!pendingEffortAttemptId) {
      return;
    }
    setError(null);
    try {
      await updateAttemptEffort(pendingEffortAttemptId, pendingEffort);
      setPendingEffortAttemptId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save effort.");
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
        <div className="session-header-actions">
          <label className="venue-selector">
            <span>Venue</span>
            <select value={currentVenueId ?? ""} onChange={(event) => handleVenueChange(event.target.value)}>
              <option value="">No venue</option>
              {activeGyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </label>
          <Link to="/" className="ghost-link">
            Home
          </Link>
        </div>
      </header>

      <section className="panel current-climb">
        <p className="label">Current Climb</p>
        {currentClimb ? (
          <>
            <div className="current-grade-line">
              <span className="grade-display">{currentClimb.grade}</span>
              {currentClimb.wallAngle !== undefined && (
                <span className="wall-angle-badge">{currentClimb.wallAngle}°</span>
              )}
            </div>
            <div className="climb-name">{currentClimb.name ?? "Unnamed climb"}</div>
            <div className="metrics-grid">
              <div>
                <span className="metric-label">Attempts</span>
                <strong>{getAttemptCount(attempts, currentClimb.id)}</strong>
              </div>
              <div>
                <span className="metric-label">Interval</span>
                <strong>
                  <IntervalTimer since={intervalStartedAt} />
                </strong>
              </div>
            </div>
            <AttemptButtons onAttempt={handleAttempt} />
            {pendingEffortAttemptId && attempts.some((attempt) => attempt.id === pendingEffortAttemptId) && (
              <div className="post-attempt-effort">
                <div className="section-heading">
                  <span className="label">Effort</span>
                  <button className="small-text-action" onClick={() => setPendingEffortAttemptId(null)}>
                    Skip
                  </button>
                </div>
                <EffortInput value={pendingEffort} onChange={setPendingEffort} />
                <button className="secondary full" onClick={handleSavePendingEffort}>
                  Save Effort
                </button>
              </div>
            )}
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
          currentVenue={currentVenue}
          grades={currentVenueGrades}
          wallAngles={currentVenueWallAngles}
          initialWallAngle={initialWallAnglePreset?.angle}
          initialWallAnglePresetId={initialWallAnglePreset?.id ?? null}
          onCancel={() => setIsAddingClimb(false)}
          onSubmit={handleAddClimb}
          submitLabel="START CLIMB"
        />
      )}

      {editingClimb && (
        <ClimbForm
          key={editingClimb.id}
          initialGrade={editingClimb.grade}
          initialGradeId={editingClimb.gradeId ?? null}
          initialGymId={editingClimb.gymId ?? null}
          initialWallAngle={editingClimb.wallAngle}
          initialWallAnglePresetId={editingClimb.wallAnglePresetId ?? null}
          initialName={editingClimb.name}
          currentVenue={editingVenue}
          grades={editingClimbGrades}
          wallAngles={editingClimbWallAngles}
          onCancel={() => setEditingClimbId(null)}
          onSubmit={handleEditClimb}
          submitLabel="SAVE CLIMB"
        />
      )}

      <ClimbList
        climbs={orderedClimbs}
        attempts={attempts}
        gyms={gyms}
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
          gyms={gyms}
          sessionStartedAt={session.startedAt}
          sessionEndedAt={session.endedAt}
          onCancel={() => setEditingAttemptId(null)}
          onDelete={deleteAttempt}
          onSave={updateAttempt}
        />
      )}

      <AttemptTimeline attempts={attempts} climbs={climbs} gyms={gyms} onEdit={(attempt) => setEditingAttemptId(attempt.id)} />

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
