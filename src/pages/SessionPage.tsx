import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AttemptEditor } from "../components/AttemptEditor";
import { AttemptTimeline } from "../components/AttemptTimeline";
import { ClimbList } from "../components/ClimbList";
import { EffortInput } from "../components/EffortInput";
import { IntervalTimer } from "../components/IntervalTimer";
import { SessionTimer } from "../components/SessionTimer";
import { useActiveSession } from "../context/ActiveSessionContext";
import {
  cancelAttempt,
  createBoardWallAngle,
  createClimb,
  createWallAngle,
  deleteAttempt,
  endSession,
  finishAttempt,
  startAttempt,
  updateAttempt,
  updateClimb,
  updateAttemptEffort,
} from "../db/repository";
import type { Attempt, AttemptEffort, AttemptResult, Board, Climb, Grade, Gym, Session, WallAngle } from "../types/domain";
import { getAttemptCount, getAttemptEndTime, isActiveAttempt, sortAttemptsByTimestamp } from "../utils/attempts";
import {
  getSavedCurrentClimbId,
  getSavedCurrentWallSelection,
  saveCurrentClimbId,
  saveCurrentWallSelection,
} from "../utils/currentClimb";
import { getReusableWallAnglePreset } from "../utils/wallAngles";

type WallSelection = {
  wallType: "gym" | "board";
  wallBoardId: string | null;
};

type ClimbDraft = {
  grade: string;
  gradeId: string | null;
  name: string;
  wallAngle: number | null;
  wallAnglePresetId: string | null;
  wallType: "gym" | "board";
  wallBoardId: string | null;
  wallLabel: string | null;
  memo: string;
};

export function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const activeSessionStore = useActiveSession();
  const {
    snapshot: storedSnapshot,
    isHydrating,
    refreshSession,
    clearSnapshot,
    setCurrentClimbId: setStoreCurrentClimbId,
    setCurrentWallSelection: setStoreCurrentWallSelection,
    upsertClimb,
    upsertAttempt,
    upsertWallAngle,
    removeAttempt,
  } = activeSessionStore;
  const snapshot = storedSnapshot?.session.id === sessionId ? storedSnapshot : null;
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [restoredUiSessionId, setRestoredUiSessionId] = useState<string | null>(null);
  const isColdLoading = !snapshot && (isHydrating || isLoadingSnapshot);
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [pendingEffortAttemptId, setPendingEffortAttemptId] = useState<string | null>(null);
  const [pendingEffort, setPendingEffort] = useState<AttemptEffort>(4);
  const [pendingAttemptNote, setPendingAttemptNote] = useState("");
  const [skipEffort, setSkipEffort] = useState(false);
  const [finishingAttemptId, setFinishingAttemptId] = useState<string | null>(null);
  const [climbDraft, setClimbDraft] = useState<ClimbDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session = snapshot?.session;
  const climbs = snapshot?.climbs ?? [];
  const attempts = snapshot?.attempts ?? [];
  const gyms = snapshot?.gyms ?? [];
  const boards = snapshot?.boards ?? [];
  const grades = snapshot?.grades ?? [];
  const wallAngles = snapshot?.wallAngles ?? [];
  const currentClimbId = snapshot?.ui.currentClimbId ?? snapshot?.currentClimbId ?? null;
  const wallSelection: WallSelection = useMemo(
    () => ({
      wallType: snapshot?.ui.currentWallType ?? "gym",
      wallBoardId: snapshot?.ui.currentWallType === "board" ? snapshot.ui.currentBoardId : null,
    }),
    [snapshot?.ui.currentBoardId, snapshot?.ui.currentWallType],
  );

  const orderedClimbs = useMemo(() => [...climbs].reverse(), [climbs]);

  useEffect(() => {
    if (!sessionId || snapshot || isHydrating) {
      return;
    }
    let isMounted = true;
    const storedClimbId = getSavedCurrentClimbId(sessionId);
    const storedWallSelection = getSavedCurrentWallSelection(sessionId);
    setIsLoadingSnapshot(true);
    void refreshSession(sessionId, storedClimbId, storedWallSelection).finally(() => {
      if (isMounted) {
        setIsLoadingSnapshot(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isHydrating, refreshSession, sessionId, snapshot]);

  useEffect(() => {
    if (!sessionId || !snapshot || restoredUiSessionId === sessionId) {
      return;
    }
    const storedClimbId = getSavedCurrentClimbId(sessionId);
    if (storedClimbId && orderedClimbs.some((climb) => climb.id === storedClimbId)) {
      setStoreCurrentClimbId(storedClimbId);
    }
    const storedWallSelection = getSavedCurrentWallSelection(sessionId);
    if (storedWallSelection) {
      setStoreCurrentWallSelection(storedWallSelection);
    }
    setRestoredUiSessionId(sessionId);
  }, [
    orderedClimbs,
    restoredUiSessionId,
    sessionId,
    setStoreCurrentClimbId,
    setStoreCurrentWallSelection,
    snapshot,
  ]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const storedClimbId = sessionId ? getSavedCurrentClimbId(sessionId) : null;
    if (!currentClimbId && storedClimbId && orderedClimbs.some((climb) => climb.id === storedClimbId)) {
      setStoreCurrentClimbId(storedClimbId);
      return;
    }
    if (!currentClimbId && orderedClimbs.length > 0) {
      setStoreCurrentClimbId(orderedClimbs[0].id);
    }
    if (currentClimbId && orderedClimbs.length > 0 && !orderedClimbs.some((climb) => climb.id === currentClimbId)) {
      setStoreCurrentClimbId(orderedClimbs[0].id);
    }
  }, [currentClimbId, orderedClimbs, sessionId, setStoreCurrentClimbId, snapshot]);

  useEffect(() => {
    if (sessionId && currentClimbId) {
      saveCurrentClimbId(sessionId, currentClimbId);
    }
  }, [currentClimbId, sessionId]);

  useEffect(() => {
    if (sessionId) {
      saveCurrentWallSelection(sessionId, wallSelection);
    }
  }, [sessionId, wallSelection]);

  useEffect(() => {
    const active = attempts.find(isActiveAttempt);
    if (active && currentClimbId !== active.climbId) {
      setStoreCurrentClimbId(active.climbId);
    }
  }, [attempts, currentClimbId, setStoreCurrentClimbId]);

  const selectedClimbForDraft = (climbs ?? []).find((climb) => climb.id === currentClimbId) ?? null;

  useEffect(() => {
    setClimbDraft(selectedClimbForDraft ? createClimbDraft(selectedClimbForDraft) : null);
  }, [selectedClimbForDraft?.id]);

  const currentClimb = climbs.find((climb) => climb.id === currentClimbId) ?? null;
  const currentClimbAttemptCount = currentClimb ? getAttemptCount(attempts, currentClimb.id) : 0;
  const shouldStartNewClimb =
    Boolean(currentClimb && climbDraft && currentClimbAttemptCount > 0 && isClimbIdentityDraftDirty(currentClimb, climbDraft));

  useEffect(() => {
    if (!currentClimb || !climbDraft) {
      return;
    }
    const identityDirty = isClimbIdentityDraftDirty(currentClimb, climbDraft);
    const memoDirty = isClimbMemoDraftDirty(currentClimb, climbDraft);
    if (!identityDirty && !memoDirty) {
      return;
    }
    if (currentClimbAttemptCount > 0 && !memoDirty) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const updateSource = currentClimbAttemptCount === 0 ? climbDraft : createClimbDraft(currentClimb);
      void updateClimb(
        currentClimb.id,
        updateSource.grade.trim() || "Ungraded",
        normalizeDraftName(updateSource.name),
        session?.initialGymId ?? null,
        updateSource.gradeId,
        updateSource.wallAngle,
        updateSource.wallAnglePresetId,
        updateSource.wallType,
        updateSource.wallBoardId,
        normalizeDraftMemo(climbDraft.memo),
      )
        .then(upsertClimb)
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Could not update climb.");
        });
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [
    climbDraft,
    currentClimb,
    currentClimbAttemptCount,
    session?.initialGymId,
    upsertClimb,
  ]);

  if (!session && isColdLoading) {
    return <main className="app-shell loading">Loading session...</main>;
  }

  if (!sessionId || !session) {
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
    .filter((wallAngle) => wallAngle.gymId === (activeSession.initialGymId ?? null) && !wallAngle.isArchived)
    .sort((a, b) => a.order - b.order);
  const activeAttempt = attempts.find(isActiveAttempt) ?? null;
  const currentClimbActiveAttempt = activeAttempt && currentClimb?.id === activeAttempt.climbId ? activeAttempt : null;
  const pendingEffortAttempt = pendingEffortAttemptId
    ? attempts.find((attempt) => attempt.id === pendingEffortAttemptId) ?? null
    : null;
  const isFinishingCurrentAttempt = finishingAttemptId !== null && finishingAttemptId === currentClimbActiveAttempt?.id;
  const editingAttempt = attempts.find((attempt) => attempt.id === editingAttemptId) ?? null;
  const lastCompletedAttempt = [...sortAttemptsByTimestamp(attempts)].reverse().find((attempt) => getAttemptEndTime(attempt));
  const restStartedAt = getAttemptEndTime(lastCompletedAttempt ?? ({} as Attempt)) ?? activeSession.startedAt;
  const initialWallAnglePreset = getReusableWallAnglePreset(climbs, activeSession.initialGymId ?? null, wallAngles);
  const selectedBoardGrades = wallSelection.wallBoardId
    ? grades.filter((grade) => grade.boardId === wallSelection.wallBoardId && !grade.isArchived).sort((a, b) => a.order - b.order)
    : [];
  const selectedBoardWallAngles = wallSelection.wallBoardId
    ? wallAngles
        .filter((wallAngle) => wallAngle.boardId === wallSelection.wallBoardId && !wallAngle.isArchived)
        .sort((a, b) => a.order - b.order)
    : [];
  const defaultGrades = wallSelection.wallType === "board" ? selectedBoardGrades : venueGrades;
  const defaultWallAngles = wallSelection.wallType === "board" ? selectedBoardWallAngles : venueWallAngles;
  const currentClimbWallAngles =
    climbDraft?.wallType === "board" && climbDraft.wallBoardId
      ? getSelectableWallAngles(wallAngles.filter((wallAngle) => wallAngle.boardId === climbDraft.wallBoardId), climbDraft.wallAnglePresetId)
      : getSelectableWallAngles(
          wallAngles.filter((wallAngle) => wallAngle.gymId === (activeSession.initialGymId ?? null)),
          climbDraft?.wallAnglePresetId ?? null,
        );
  const currentClimbGrades =
    climbDraft?.wallType === "board" && climbDraft.wallBoardId
      ? getSelectableGrades(
          grades.filter((grade) => grade.boardId === climbDraft.wallBoardId),
          climbDraft.gradeId,
        )
      : getSelectableGrades(
          grades.filter((grade) => grade.gymId === (activeSession.initialGymId ?? null)),
          climbDraft?.gradeId ?? null,
        );

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
        null,
      );
      setStoreCurrentWallSelection({ wallType: sourceWallType, wallBoardId: sourceWallBoardId });
      upsertClimb(climb);
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
    setStoreCurrentClimbId(climbId);
  }

  async function handleStartAttempt() {
    if (!sessionId || !currentClimb || !climbDraft) {
      return;
    }
    setError(null);
    try {
      let targetClimbId = currentClimb.id;
      if (isClimbIdentityDraftDirty(currentClimb, climbDraft)) {
        if (currentClimbAttemptCount === 0) {
          const updatedClimb = await updateClimb(
            currentClimb.id,
            climbDraft.grade.trim() || "Ungraded",
            normalizeDraftName(climbDraft.name),
            activeSession.initialGymId ?? null,
            climbDraft.gradeId,
            climbDraft.wallAngle,
            climbDraft.wallAnglePresetId,
            climbDraft.wallType,
            climbDraft.wallBoardId,
            normalizeDraftMemo(climbDraft.memo),
          );
          upsertClimb(updatedClimb);
        } else {
          const nextClimb = await createClimb(
            sessionId,
            climbDraft.grade.trim() || "Ungraded",
            normalizeDraftName(climbDraft.name),
            activeSession.initialGymId ?? null,
            climbDraft.gradeId,
            climbDraft.wallAngle,
            climbDraft.wallAnglePresetId,
            climbDraft.wallType,
            climbDraft.wallBoardId,
            normalizeDraftMemo(climbDraft.memo),
          );
          targetClimbId = nextClimb.id;
          upsertClimb(nextClimb);
        }
      }
      const attempt = await startAttempt(sessionId, targetClimbId);
      upsertAttempt(attempt);
      setStoreCurrentClimbId(targetClimbId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start attempt.");
    }
  }

  async function handleFinishAttempt(result: AttemptResult) {
    if (!currentClimbActiveAttempt) {
      return;
    }
    setError(null);
    setFinishingAttemptId(currentClimbActiveAttempt.id);
    setPendingEffortAttemptId(currentClimbActiveAttempt.id);
    setPendingEffort(currentClimbActiveAttempt.effort ?? 4);
    setPendingAttemptNote(currentClimbActiveAttempt.note ?? "");
    try {
      const attempt = await finishAttempt(currentClimbActiveAttempt.id, result);
      upsertAttempt(attempt);
      setFinishingAttemptId(null);
    } catch (err) {
      setFinishingAttemptId(null);
      setPendingEffortAttemptId(null);
      setPendingAttemptNote("");
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
      removeAttempt(currentClimbActiveAttempt.id);
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
      const attempt = await updateAttemptEffort(pendingEffortAttemptId, skipEffort ? null : pendingEffort, pendingAttemptNote);
      upsertAttempt(attempt);
      setPendingEffortAttemptId(null);
      setPendingAttemptNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save effort.");
    }
  }

  async function handleDeleteAttempt(attemptId: string) {
    await deleteAttempt(attemptId);
    removeAttempt(attemptId);
  }

  async function handleSaveAttempt(attemptId: string, update: Parameters<typeof updateAttempt>[1]) {
    const attempt = await updateAttempt(attemptId, update);
    upsertAttempt(attempt);
  }

  async function handleEndSession() {
    if (!sessionId || !window.confirm("End this session?")) {
      return;
    }
    setError(null);
    try {
      await endSession(sessionId);
      clearSnapshot();
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
          <button type="button" className="ghost-link" onClick={() => navigate("/")}>
            Home
          </button>
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
                setStoreCurrentWallSelection({ wallType: "gym", wallBoardId: null });
                return;
              }
              setStoreCurrentWallSelection({ wallType: "board", wallBoardId: event.target.value.replace("board:", "") });
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
          {shouldStartNewClimb && <p className="muted compact new-climb-hint">Changes will start a new climb.</p>}
        </div>
        {currentClimb ? (
          <div className="current-climb-card">
            <div className="current-climb-layout">
              {climbDraft && (
                <EditableClimbCard
                  climb={currentClimb}
                  draft={climbDraft}
                  venueGymId={activeSession.initialGymId ?? null}
                  grades={currentClimbGrades}
                  wallAngles={currentClimbWallAngles}
                  boards={boards}
                  onDraftChange={(update) => setClimbDraft((current) => (current ? { ...current, ...update } : current))}
                  onWallAngleChange={upsertWallAngle}
                  onError={setError}
                />
              )}
              <div className="climb-stats-layout climb-stats-stack">
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
            <div className="climb-action-card climb-bottom-action">
              {climbDraft && (
                <label className="climb-memo-field">
                  Memo
                  <textarea
                    value={climbDraft.memo}
                    placeholder="Beta, crux, footholds..."
                    onChange={(event) => setClimbDraft((current) => (current ? { ...current, memo: event.target.value } : current))}
                  />
                </label>
              )}
              {pendingEffortAttempt ? (
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
                  <label className="attempt-note-field">
                    Memo
                    <textarea
                      value={pendingAttemptNote}
                      placeholder="Slip, beta, why it failed..."
                      onChange={(event) => setPendingAttemptNote(event.target.value)}
                    />
                  </label>
                  <button className="secondary full" disabled={Boolean(finishingAttemptId)} onClick={handleSavePendingEffort}>
                    Save
                  </button>
                </div>
              ) : currentClimbActiveAttempt ? (
                <div className="attempt-action-grid">
                  <button className="danger" disabled={isFinishingCurrentAttempt} onClick={() => handleFinishAttempt("fail")}>
                    FAIL
                  </button>
                  <button className="primary" disabled={isFinishingCurrentAttempt} onClick={() => handleFinishAttempt("send")}>
                    SEND
                  </button>
                  <button className="secondary full" disabled={isFinishingCurrentAttempt} onClick={handleCancelAttempt}>
                    Cancel Attempt
                  </button>
                </div>
              ) : (
                <>
                  <button className="primary climb-start-button" disabled={Boolean(activeAttempt)} onClick={handleStartAttempt}>
                    START
                  </button>
                </>
              )}
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
          onDelete={handleDeleteAttempt}
          onSave={handleSaveAttempt}
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
  draft,
  venueGymId,
  grades,
  wallAngles,
  boards,
  onDraftChange,
  onWallAngleChange,
  onError,
}: {
  climb: Climb;
  draft: ClimbDraft;
  venueGymId: string | null;
  grades: Grade[];
  wallAngles: WallAngle[];
  boards: Board[];
  onDraftChange: (update: Partial<ClimbDraft>) => void;
  onWallAngleChange: (wallAngle: WallAngle) => void;
  onError: (message: string | null) => void;
}) {
  const [newWallAngle, setNewWallAngle] = useState("");
  const [isAddingWallAngle, setIsAddingWallAngle] = useState(false);
  const currentWallValue = draft.wallType === "board" && draft.wallBoardId ? `board:${draft.wallBoardId}` : "gym";
  const gradeOptions = getGradeOptionsForSelect(draft.gradeId, draft.grade, grades);
  const gradeSelectValue = getGradeSelectValue(draft.gradeId, draft.grade, gradeOptions);
  const angleOptions = getWallAngleOptionsForSelect(draft.wallAnglePresetId, draft.wallAngle, wallAngles);
  const wallAngleSelectValue = getWallAngleSelectValue(draft.wallAnglePresetId, draft.wallAngle, angleOptions);
  return (
    <div className="editable-climb-card">
      <div className="climb-field-row">
        <label className="climb-field-grade">
          Grade
          <select
            value={gradeSelectValue}
            onChange={(event) => {
              if (event.target.value === SNAPSHOT_GRADE_OPTION_ID) {
                return;
              }
              const grade = grades.find((item) => item.id === event.target.value) ?? null;
              onDraftChange({ grade: grade?.label ?? "Ungraded", gradeId: grade?.id ?? null });
            }}
          >
            <option value="">Select</option>
            {gradeOptions.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.label}
              </option>
            ))}
          </select>
        </label>
        <label className="climb-field-angle">
          Wall angle
          <select
            value={wallAngleSelectValue}
            onChange={(event) => {
              if (event.target.value === "__add_angle__") {
                setIsAddingWallAngle(true);
                setNewWallAngle("");
                return;
              }
              if (event.target.value === SNAPSHOT_WALL_ANGLE_OPTION_ID) {
                return;
              }
              const angle = wallAngles.find((item) => item.id === event.target.value) ?? null;
              if (!angle && event.target.value === draft.wallAnglePresetId) {
                return;
              }
              onDraftChange({
                wallAnglePresetId: angle?.id ?? null,
                wallAngle: angle?.angle ?? null,
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
          value={draft.name}
          placeholder="Yellow #12"
          onChange={(event) => onDraftChange({ name: event.target.value })}
        />
      </label>
      <label>
        Wall
        <select
          value={currentWallValue}
          onChange={(event) => {
            if (event.target.value === "gym") {
              onDraftChange({
                wallType: "gym",
                wallBoardId: null,
                wallLabel: "Gym Wall",
                gradeId: null,
                wallAngle: null,
                wallAnglePresetId: null,
              });
              return;
            }
            const boardId = event.target.value.replace("board:", "");
            const board = boards.find((item) => item.id === boardId) ?? null;
            onDraftChange({
              wallType: "board",
              wallBoardId: boardId,
              wallLabel: board?.name ?? null,
              gradeId: null,
              wallAngle: null,
              wallAnglePresetId: null,
            });
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
                draft.wallType === "board" && draft.wallBoardId
                  ? await createBoardWallAngle(draft.wallBoardId, parsedAngle)
                  : venueGymId
                    ? await createWallAngle(venueGymId, parsedAngle)
                    : null;
              if (!createdAngle) {
                onError("Cannot add a wall angle without a gym or board.");
                return;
              }
              onDraftChange({
                wallAnglePresetId: createdAngle.id,
                wallAngle: createdAngle.angle,
              });
              onWallAngleChange(createdAngle);
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

function createClimbDraft(climb: Climb): ClimbDraft {
  return {
    grade: climb.grade,
    gradeId: climb.gradeId ?? null,
    name: climb.name ?? "",
    wallAngle: climb.wallAngle ?? null,
    wallAnglePresetId: climb.wallAnglePresetId ?? null,
    wallType: climb.wallType ?? "gym",
    wallBoardId: climb.wallBoardId ?? null,
    wallLabel: climb.wallLabel ?? null,
    memo: climb.memo ?? "",
  };
}

function normalizeDraftName(name: string): string | null {
  return name.trim() || null;
}

function normalizeDraftMemo(memo: string): string | null {
  return memo.trim() || null;
}

function getSelectableWallAngles(wallAngles: WallAngle[], currentWallAnglePresetId: string | null): WallAngle[] {
  return wallAngles
    .filter((wallAngle) => !wallAngle.isArchived || wallAngle.id === currentWallAnglePresetId)
    .sort((a, b) => a.order - b.order);
}

function getSelectableGrades(grades: Grade[], currentGradeId: string | null): Grade[] {
  return grades
    .filter((grade) => !grade.isArchived || grade.id === currentGradeId)
    .sort((a, b) => a.order - b.order);
}

const SNAPSHOT_GRADE_OPTION_ID = "__snapshot_grade__";
const SNAPSHOT_WALL_ANGLE_OPTION_ID = "__snapshot_wall_angle__";

export function getGradeOptionsForSelect(
  gradeId: string | null,
  gradeLabel: string,
  grades: Grade[],
): Array<{ id: string; label: string }> {
  const hasCurrentGrade = gradeId !== null && grades.some((grade) => grade.id === gradeId);
  const trimmedGradeLabel = gradeLabel.trim();
  return trimmedGradeLabel && trimmedGradeLabel !== "Ungraded" && (!gradeId || !hasCurrentGrade)
    ? [
        {
          id: gradeId ?? SNAPSHOT_GRADE_OPTION_ID,
          label: trimmedGradeLabel,
        },
        ...grades.map((grade) => ({ id: grade.id, label: grade.label })),
      ]
    : grades.map((grade) => ({ id: grade.id, label: grade.label }));
}

function getGradeSelectValue(
  gradeId: string | null,
  gradeLabel: string,
  gradeOptions: Array<{ id: string; label: string }>,
): string {
  if (gradeId && gradeOptions.some((grade) => grade.id === gradeId)) {
    return gradeId;
  }
  return gradeLabel.trim() && gradeLabel.trim() !== "Ungraded" ? SNAPSHOT_GRADE_OPTION_ID : "";
}

export function getWallAngleOptionsForSelect(
  wallAnglePresetId: string | null,
  wallAngle: number | null,
  wallAngles: WallAngle[],
): Array<{ id: string; angle: number; label: string }> {
  const hasCurrentWallAnglePreset =
    wallAnglePresetId !== null && wallAngles.some((angle) => angle.id === wallAnglePresetId);
  return wallAngle !== null && (!wallAnglePresetId || !hasCurrentWallAnglePreset)
    ? [
        {
          id: wallAnglePresetId ?? SNAPSHOT_WALL_ANGLE_OPTION_ID,
          angle: wallAngle,
          label: `${wallAngle}°`,
        },
        ...wallAngles.map((angle) => ({ id: angle.id, angle: angle.angle, label: `${angle.angle}°` })),
      ]
    : wallAngles.map((angle) => ({ id: angle.id, angle: angle.angle, label: `${angle.angle}°` }));
}

function getWallAngleSelectValue(
  wallAnglePresetId: string | null,
  wallAngle: number | null,
  wallAngleOptions: Array<{ id: string; angle: number; label: string }>,
): string {
  if (wallAnglePresetId && wallAngleOptions.some((angle) => angle.id === wallAnglePresetId)) {
    return wallAnglePresetId;
  }
  return wallAngle !== null ? SNAPSHOT_WALL_ANGLE_OPTION_ID : "";
}

function isClimbIdentityDraftDirty(climb: Climb, draft: ClimbDraft): boolean {
  return (
    climb.grade !== draft.grade ||
    (climb.gradeId ?? null) !== draft.gradeId ||
    (climb.name ?? "") !== draft.name ||
    (climb.wallAngle ?? null) !== draft.wallAngle ||
    (climb.wallAnglePresetId ?? null) !== draft.wallAnglePresetId ||
    (climb.wallType ?? "gym") !== draft.wallType ||
    (climb.wallBoardId ?? null) !== draft.wallBoardId ||
    (climb.wallLabel ?? null) !== draft.wallLabel
  );
}

function isClimbMemoDraftDirty(climb: Climb, draft: ClimbDraft): boolean {
  return (climb.memo ?? null) !== normalizeDraftMemo(draft.memo);
}

function NavigateToSummary({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/session/${sessionId}/summary`, { replace: true });
  }, [navigate, sessionId]);
  return <main className="app-shell loading">Opening summary...</main>;
}
