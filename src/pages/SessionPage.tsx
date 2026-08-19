import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AttemptEditor } from "../components/AttemptEditor";
import { AttemptTimeline } from "../components/AttemptTimeline";
import { ClimbList } from "../components/ClimbList";
import { EffortInput } from "../components/EffortInput";
import { IntervalTimer } from "../components/IntervalTimer";
import { SessionTimer } from "../components/SessionTimer";
import {
  cancelAttempt,
  createBoardWallAngle,
  createClimb,
  createWallAngle,
  deleteAttempt,
  endSession,
  finishAttempt,
  getActiveBoards,
  getAllGrades,
  getAllGyms,
  getAllWallAngles,
  getSession,
  getSessionAttempts,
  getSessionClimbs,
  startAttempt,
  updateAttempt,
  updateAttemptEffort,
  updateClimb,
} from "../db/repository";
import type { Attempt, AttemptEffort, AttemptResult, Board, Climb, Grade, Gym, Session, WallAngle } from "../types/domain";
import { getAttemptCount, getAttemptEndTime, isActiveAttempt, sortAttemptsByTimestamp } from "../utils/attempts";
import { currentClimbStorageKey } from "../utils/currentClimb";
import { getReusableWallAnglePreset } from "../utils/wallAngles";

type WallSelection = {
  wallType: "gym" | "board";
  wallBoardId: string | null;
};

export function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [currentClimbId, setCurrentClimbId] = useState<string | null>(null);
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [wallSelection, setWallSelection] = useState<WallSelection>({ wallType: "gym", wallBoardId: null });
  const [pendingEffortAttemptId, setPendingEffortAttemptId] = useState<string | null>(null);
  const [pendingEffort, setPendingEffort] = useState<AttemptEffort>(4);
  const [skipEffort, setSkipEffort] = useState(false);
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
  const boards = useLiveQuery<Board[]>(() => getActiveBoards(), []);
  const grades = useLiveQuery<Grade[]>(() => getAllGrades(), []);
  const wallAngles = useLiveQuery<WallAngle[]>(() => getAllWallAngles(), []);

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

  useEffect(() => {
    const active = attempts?.find(isActiveAttempt);
    if (active && currentClimbId !== active.climbId) {
      setCurrentClimbId(active.climbId);
    }
  }, [attempts, currentClimbId]);

  if (session === undefined || !climbs || !attempts || !gyms || !boards || !grades || !wallAngles) {
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
  const venue = activeSession.initialGymId ? gyms.find((gym) => gym.id === activeSession.initialGymId) ?? null : null;
  const venueGrades = grades
    .filter((grade) => grade.gymId === (activeSession.initialGymId ?? null) && !grade.isArchived)
    .sort((a, b) => a.order - b.order);
  const venueWallAngles = wallAngles
    .filter((wallAngle) => wallAngle.gymId === (activeSession.initialGymId ?? null))
    .sort((a, b) => a.order - b.order);
  const currentClimb = climbs.find((climb) => climb.id === currentClimbId) ?? null;
  const activeAttempt = attempts.find(isActiveAttempt) ?? null;
  const currentClimbActiveAttempt = activeAttempt && currentClimb?.id === activeAttempt.climbId ? activeAttempt : null;
  const pendingEffortAttempt = pendingEffortAttemptId
    ? attempts.find((attempt) => attempt.id === pendingEffortAttemptId) ?? null
    : null;
  const editingAttempt = attempts.find((attempt) => attempt.id === editingAttemptId) ?? null;
  const lastCompletedAttempt = [...sortAttemptsByTimestamp(attempts)].reverse().find((attempt) => getAttemptEndTime(attempt));
  const restStartedAt = getAttemptEndTime(lastCompletedAttempt ?? ({} as Attempt)) ?? activeSession.startedAt;
  const initialWallAnglePreset = getReusableWallAnglePreset(climbs, activeSession.initialGymId ?? null, wallAngles);
  const selectedBoardGrades = wallSelection.wallBoardId
    ? grades.filter((grade) => grade.boardId === wallSelection.wallBoardId && !grade.isArchived).sort((a, b) => a.order - b.order)
    : [];
  const selectedBoardWallAngles = wallSelection.wallBoardId
    ? wallAngles.filter((wallAngle) => wallAngle.boardId === wallSelection.wallBoardId).sort((a, b) => a.order - b.order)
    : [];
  const defaultGrades = wallSelection.wallType === "board" ? selectedBoardGrades : venueGrades;
  const defaultWallAngles = wallSelection.wallType === "board" ? selectedBoardWallAngles : venueWallAngles;
  const currentClimbGrades =
    currentClimb?.wallType === "board" && currentClimb.wallBoardId
      ? grades.filter((grade) => grade.boardId === currentClimb.wallBoardId && !grade.isArchived).sort((a, b) => a.order - b.order)
      : venueGrades;
  const currentClimbWallAngles =
    currentClimb?.wallType === "board" && currentClimb.wallBoardId
      ? wallAngles.filter((wallAngle) => wallAngle.boardId === currentClimb.wallBoardId).sort((a, b) => a.order - b.order)
      : venueWallAngles;

  async function handleAddClimb() {
    if (!sessionId) {
      return;
    }
    if (activeAttempt) {
      setError("Finish or cancel the active attempt before changing climbs.");
      return;
    }
    setError(null);
    try {
      const sourceClimb = currentClimb ?? orderedClimbs[0] ?? null;
      const sourceWallType = sourceClimb?.wallType ?? wallSelection.wallType;
      const sourceWallBoardId = sourceClimb ? sourceClimb.wallBoardId ?? null : wallSelection.wallBoardId;
      const sourceGrades =
        sourceWallType === "board" && sourceWallBoardId
          ? (grades ?? []).filter((grade) => grade.boardId === sourceWallBoardId && !grade.isArchived).sort((a, b) => a.order - b.order)
          : venueGrades;
      const sourceWallAngles =
        sourceWallType === "board" && sourceWallBoardId
          ? (wallAngles ?? []).filter((wallAngle) => wallAngle.boardId === sourceWallBoardId).sort((a, b) => a.order - b.order)
          : venueWallAngles;
      const defaultWallAngle = wallSelection.wallType === "board" ? defaultWallAngles[0] ?? null : initialWallAnglePreset;
      const sourceGrade =
        sourceClimb?.gradeId ? sourceGrades.find((grade) => grade.id === sourceClimb.gradeId) ?? null : null;
      const sourceWallAngle =
        sourceClimb?.wallAnglePresetId
          ? sourceWallAngles.find((wallAngle) => wallAngle.id === sourceClimb.wallAnglePresetId) ?? null
          : null;
      const grade = sourceGrade ?? sourceGrades[0] ?? null;
      const wallAngleValue = sourceWallAngle?.angle ?? sourceClimb?.wallAngle ?? defaultWallAngle?.angle ?? null;
      const wallAnglePresetId = sourceWallAngle?.id ?? (sourceClimb?.wallAngle === wallAngleValue ? null : defaultWallAngle?.id ?? null);
      const climb = await createClimb(
        sessionId,
        grade?.label ?? "Ungraded",
        null,
        activeSession.initialGymId ?? null,
        grade?.id ?? null,
        wallAngleValue,
        wallAnglePresetId,
        sourceWallType,
        sourceWallBoardId,
      );
      setWallSelection({ wallType: sourceWallType, wallBoardId: sourceWallBoardId });
      setCurrentClimbId(climb.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add climb.");
    }
  }

  function handleSelectClimb(climbId: string) {
    if (activeAttempt && activeAttempt.climbId !== climbId) {
      setError("Finish or cancel the active attempt before changing climbs.");
      return;
    }
    setError(null);
    setCurrentClimbId(climbId);
  }

  async function handleUpdateClimb(climb: Climb, update: Partial<Climb>) {
    setError(null);
    try {
      await updateClimb(
        climb.id,
        update.grade ?? climb.grade,
        update.name === undefined ? climb.name : update.name,
        activeSession.initialGymId ?? null,
        update.gradeId === undefined ? climb.gradeId ?? null : update.gradeId ?? null,
        update.wallAngle === undefined ? climb.wallAngle ?? null : update.wallAngle ?? null,
        update.wallAnglePresetId === undefined ? climb.wallAnglePresetId ?? null : update.wallAnglePresetId ?? null,
        update.wallType ?? climb.wallType ?? "gym",
        update.wallBoardId === undefined ? climb.wallBoardId ?? null : update.wallBoardId ?? null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update climb.");
    }
  }

  async function handleStartAttempt() {
    if (!sessionId || !currentClimb) {
      return;
    }
    setError(null);
    try {
      await startAttempt(sessionId, currentClimb.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start attempt.");
    }
  }

  async function handleFinishAttempt(result: AttemptResult) {
    if (!currentClimbActiveAttempt) {
      return;
    }
    setError(null);
    try {
      await finishAttempt(currentClimbActiveAttempt.id, result);
      setPendingEffortAttemptId(currentClimbActiveAttempt.id);
      setPendingEffort(currentClimbActiveAttempt.effort ?? 4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish attempt.");
    }
  }

  async function handleCancelAttempt() {
    if (!currentClimbActiveAttempt || !window.confirm("Cancel this active attempt?")) {
      return;
    }
    setError(null);
    try {
      await cancelAttempt(currentClimbActiveAttempt.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel attempt.");
    }
  }

  async function handleSavePendingEffort() {
    if (!pendingEffortAttemptId) {
      return;
    }
    setError(null);
    try {
      await updateAttemptEffort(pendingEffortAttemptId, skipEffort ? null : pendingEffort);
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
            <SessionTimer startedAt={activeSession.startedAt} />
          </h1>
        </div>
        <div className="session-header-actions">
          <Link to="/" className="ghost-link">
            Home
          </Link>
        </div>
      </header>

      <section className="panel venue-wall-panel">
        <div>
          <span className="metric-label">Venue</span>
          <strong>{venue?.name ?? "No Gym"}</strong>
        </div>
        <label>
          Wall
          <select
            value={wallSelection.wallType === "gym" ? "gym" : `board:${wallSelection.wallBoardId}`}
            onChange={(event) => {
              if (event.target.value === "gym") {
                setWallSelection({ wallType: "gym", wallBoardId: null });
                return;
              }
              setWallSelection({ wallType: "board", wallBoardId: event.target.value.replace("board:", "") });
            }}
          >
            <option value="gym">Gym Wall</option>
            {boards.length > 0 && <option disabled>────────</option>}
            {boards.map((board) => (
              <option key={board.id} value={`board:${board.id}`}>
                {board.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel current-climb">
        <div className="section-heading">
          <p className="label">Current Climb</p>
        </div>
        {currentClimb ? (
          <div className="current-climb-card">
            <div className="current-climb-layout">
              <EditableClimbCard
                climb={currentClimb}
                venueGymId={activeSession.initialGymId ?? null}
                grades={currentClimbGrades}
                wallAngles={currentClimbWallAngles}
                boards={boards}
                onUpdate={handleUpdateClimb}
                onError={setError}
              />
              <div className="climb-action-card">
                {currentClimbActiveAttempt ? (
                  <div className="attempt-action-grid">
                    <button className="danger" onClick={() => handleFinishAttempt("fail")}>
                      FAIL
                    </button>
                    <button className="primary" onClick={() => handleFinishAttempt("send")}>
                      SEND
                    </button>
                    <button className="secondary full" onClick={handleCancelAttempt}>
                      Cancel Attempt
                    </button>
                  </div>
                ) : pendingEffortAttempt ? (
                  <div className="post-attempt-effort">
                    <div className="section-heading">
                      <span className="label">Effort</span>
                      <label className="skip-effort-toggle">
                        <input
                          type="checkbox"
                          checked={skipEffort}
                          onChange={(event) => setSkipEffort(event.target.checked)}
                        />
                        Skip
                      </label>
                    </div>
                    {skipEffort ? (
                      <p className="muted compact">Effort will not be recorded.</p>
                    ) : (
                      <EffortInput value={pendingEffort} onChange={setPendingEffort} />
                    )}
                    <button className="secondary full" onClick={handleSavePendingEffort}>
                      Save
                    </button>
                  </div>
                ) : (
                  <button className="primary climb-start-button" disabled={Boolean(activeAttempt)} onClick={handleStartAttempt}>
                    START
                  </button>
                )}
              </div>
            </div>
            <div className="climb-stats-layout">
              <div className="climb-stat-card">
                <span className="metric-label">Attempts</span>
                <strong>{getAttemptCount(attempts, currentClimb.id)}</strong>
              </div>
              <div className="climb-stat-card">
                <span className="metric-label">{currentClimbActiveAttempt ? "Action" : "Rest"}</span>
                <strong>
                  {currentClimbActiveAttempt?.startedAt ? (
                    <IntervalTimer since={currentClimbActiveAttempt.startedAt} />
                  ) : (
                    <IntervalTimer since={restStartedAt} />
                  )}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <button className="primary full" onClick={handleAddClimb}>
            Start Climb
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <ClimbList
        climbs={orderedClimbs}
        attempts={attempts}
        gyms={gyms}
        currentClimbId={currentClimbId}
        onSelect={handleSelectClimb}
        onAdd={handleAddClimb}
        onEdit={(climb) => handleSelectClimb(climb.id)}
      />

      {editingAttempt && (
        <AttemptEditor
          key={editingAttempt.id}
          attempt={editingAttempt}
          climbs={climbs}
          gyms={gyms}
          sessionStartedAt={activeSession.startedAt}
          sessionEndedAt={activeSession.endedAt}
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

function EditableClimbCard({
  climb,
  venueGymId,
  grades,
  wallAngles,
  boards,
  onUpdate,
  onError,
}: {
  climb: Climb;
  venueGymId: string | null;
  grades: Grade[];
  wallAngles: WallAngle[];
  boards: Board[];
  onUpdate: (climb: Climb, update: Partial<Climb>) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [newWallAngle, setNewWallAngle] = useState("");
  const [isAddingWallAngle, setIsAddingWallAngle] = useState(false);
  const currentWallValue = climb.wallType === "board" && climb.wallBoardId ? `board:${climb.wallBoardId}` : "gym";
  const hasCurrentWallAnglePreset =
    climb.wallAnglePresetId !== undefined &&
    climb.wallAnglePresetId !== null &&
    wallAngles.some((angle) => angle.id === climb.wallAnglePresetId);
  const angleOptions =
    climb.wallAnglePresetId && climb.wallAngle !== undefined && !hasCurrentWallAnglePreset
      ? [
          {
            id: climb.wallAnglePresetId,
            angle: climb.wallAngle,
            label: `${climb.wallAngle}° (saved)`,
          },
          ...wallAngles.map((angle) => ({ id: angle.id, angle: angle.angle, label: `${angle.angle}°` })),
        ]
      : wallAngles.map((angle) => ({ id: angle.id, angle: angle.angle, label: `${angle.angle}°` }));
  return (
    <div className="editable-climb-card">
      <div className="climb-field-row">
        <label className="climb-field-grade">
          Grade
          <select
            value={climb.gradeId ?? ""}
            onChange={(event) => {
              const grade = grades.find((item) => item.id === event.target.value) ?? null;
              void onUpdate(climb, { grade: grade?.label ?? climb.grade, gradeId: grade?.id ?? null });
            }}
          >
            <option value="">Select</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.label}
              </option>
            ))}
          </select>
        </label>
        <label className="climb-field-angle">
          Wall angle
          <select
            value={climb.wallAnglePresetId ?? ""}
            onChange={(event) => {
              if (event.target.value === "__add_angle__") {
                setIsAddingWallAngle(true);
                setNewWallAngle("");
                return;
              }
              const angle = wallAngles.find((item) => item.id === event.target.value) ?? null;
              if (!angle && event.target.value === climb.wallAnglePresetId) {
                return;
              }
              void onUpdate(climb, {
                wallAnglePresetId: angle?.id ?? null,
                wallAngle: angle?.angle ?? undefined,
              });
            }}
          >
            <option value="">No angle</option>
            {angleOptions.map((angle) => (
              <option key={angle.id} value={angle.id}>
                {angle.label}
              </option>
            ))}
            <option value="__add_angle__">+ Add angle</option>
          </select>
        </label>
      </div>
      <label>
        Name / Number
        <input
          key={climb.id}
          defaultValue={climb.name ?? ""}
          placeholder="Yellow #12"
          onBlur={(event) => void onUpdate(climb, { name: event.target.value.trim() || null })}
        />
      </label>
      <label>
        Wall
        <select
          value={currentWallValue}
          onChange={(event) => {
            if (event.target.value === "gym") {
              void onUpdate(climb, { wallType: "gym", wallBoardId: null, wallLabel: "Gym Wall" });
              return;
            }
            void onUpdate(climb, { wallType: "board", wallBoardId: event.target.value.replace("board:", "") });
          }}
        >
          <option value="gym">Gym Wall</option>
          {boards.length > 0 && <option disabled>────────</option>}
          {boards.map((board) => (
            <option key={board.id} value={`board:${board.id}`}>
              {board.name}
            </option>
          ))}
        </select>
      </label>
      {isAddingWallAngle && (
        <form
          className="wall-angle-popover"
          onSubmit={async (event) => {
            event.preventDefault();
            const parsedAngle = Number(newWallAngle.trim());
            if (!newWallAngle.trim() || !Number.isFinite(parsedAngle)) {
              onError("Wall angle must be a number.");
              return;
            }
            try {
              const createdAngle =
                climb.wallType === "board" && climb.wallBoardId
                  ? await createBoardWallAngle(climb.wallBoardId, parsedAngle)
                  : venueGymId
                    ? await createWallAngle(venueGymId, parsedAngle)
                    : null;
              if (!createdAngle) {
                onError("Cannot add a wall angle without a gym or board.");
                return;
              }
              await onUpdate(climb, {
                wallAnglePresetId: createdAngle.id,
                wallAngle: createdAngle.angle,
              });
              setNewWallAngle("");
              setIsAddingWallAngle(false);
              onError(null);
            } catch (err) {
              onError(err instanceof Error ? err.message : "Could not add wall angle.");
            }
          }}
        >
          <input
            autoFocus
            inputMode="decimal"
            value={newWallAngle}
            onChange={(event) => setNewWallAngle(event.target.value)}
            placeholder="120"
            aria-label="New wall angle"
          />
          <span>°</span>
          <button type="submit">Add</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setIsAddingWallAngle(false);
              setNewWallAngle("");
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

function NavigateToSummary({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/session/${sessionId}/summary`, { replace: true });
  }, [navigate, sessionId]);
  return <main className="app-shell loading">Opening summary...</main>;
}
