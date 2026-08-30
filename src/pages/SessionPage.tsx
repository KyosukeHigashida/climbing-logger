import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AttemptEditor } from "../components/AttemptEditor";
import { AttemptTimeline } from "../components/AttemptTimeline";
import { ClimbList } from "../components/ClimbList";
import { EffortInput } from "../components/EffortInput";
import { IntervalTimer } from "../components/IntervalTimer";
import { SessionTimer } from "../components/SessionTimer";
import { StrengthSetEditor } from "../components/StrengthSetEditor";
import { useActiveSession } from "../context/ActiveSessionContext";
import {
  cancelAttempt,
  createBoardWallAngle,
  createClimb,
  createWallAngle,
  deleteAttempt,
  deleteStrengthSet,
  endSession,
  finishAttempt,
  cancelStrengthSet,
  finishStrengthSet,
  startAttempt,
  startStrengthSet,
  updateAttempt,
  updateClimb,
  updateAttemptEffort,
  updateStrengthSet,
  updateStrengthSetMetadata,
} from "../db/repository";
import type { Attempt, AttemptEffort, AttemptResult, Board, Climb, Grade, Gym, Session, StrengthSet, WallAngle } from "../types/domain";
import { getAttemptCount, isActiveAttempt } from "../utils/attempts";
import {
  getSavedCurrentClimbId,
  getSavedCurrentWallSelection,
  saveCurrentClimbId,
  saveCurrentWallSelection,
} from "../utils/currentClimb";
import { getReusableWallAnglePreset } from "../utils/wallAngles";
import { getStrengthNameSuggestions } from "../utils/recentActivity";
import {
  getCompletedStrengthSetCountForIdentity,
  getStrengthSetCardKey,
  getLastCompletedPhysicalActivityEnd,
  getLatestStrengthSetByName,
  type StrengthSetIdentity,
} from "../utils/strengthSets";
import { getOptionalNumericInputError, parseOptionalNumericInput } from "../utils/numericInput";

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

type TrainingDraft = {
  name: string;
  weight: string;
  reps: string;
  workDurationSeconds: string;
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
    setCurrentActivityType,
    upsertClimb,
    upsertAttempt,
    upsertWallAngle,
    upsertStrengthSet,
    removeAttempt,
    removeStrengthSet,
  } = activeSessionStore;
  const snapshot = storedSnapshot?.session.id === sessionId ? storedSnapshot : null;
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [restoredUiSessionId, setRestoredUiSessionId] = useState<string | null>(null);
  const isColdLoading = !snapshot && (isHydrating || isLoadingSnapshot);
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [editingStrengthSetId, setEditingStrengthSetId] = useState<string | null>(null);
  const [pendingEffortAttemptId, setPendingEffortAttemptId] = useState<string | null>(null);
  const [pendingStrengthSetId, setPendingStrengthSetId] = useState<string | null>(null);
  const [pendingEffort, setPendingEffort] = useState<AttemptEffort>(4);
  const [pendingAttemptNote, setPendingAttemptNote] = useState("");
  const [skipEffort, setSkipEffort] = useState(false);
  const [finishingAttemptId, setFinishingAttemptId] = useState<string | null>(null);
  const [finishingStrengthSetId, setFinishingStrengthSetId] = useState<string | null>(null);
  const [climbDraft, setClimbDraft] = useState<ClimbDraft | null>(null);
  const [trainingDraft, setTrainingDraft] = useState<TrainingDraft>({ name: "", weight: "", reps: "", workDurationSeconds: "", memo: "" });
  const [isTrainingDraftOpen, setIsTrainingDraftOpen] = useState(false);
  const [selectedStrengthSetId, setSelectedStrengthSetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session = snapshot?.session;
  const climbs = snapshot?.climbs ?? [];
  const attempts = snapshot?.attempts ?? [];
  const strengthSets = snapshot?.strengthSets ?? [];
  const gyms = snapshot?.gyms ?? [];
  const boards = snapshot?.boards ?? [];
  const activeBoards = useMemo(() => boards.filter((board) => !board.isArchived), [boards]);
  const grades = snapshot?.grades ?? [];
  const wallAngles = snapshot?.wallAngles ?? [];
  const currentActivityType = snapshot?.ui.currentActivityType ?? "climb";
  const currentClimbId = snapshot?.ui.currentClimbId ?? null;
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

  useEffect(() => {
    setClimbDraft((current) => {
      if (!current) {
        return current;
      }

      const selectedGrade = current.gradeId ? grades.find((grade) => grade.id === current.gradeId) ?? null : null;
      const hasValidGrade =
        selectedGrade &&
        !selectedGrade.isArchived &&
        ((current.wallType === "board" && selectedGrade.boardId === current.wallBoardId) ||
          (current.wallType === "gym" && selectedGrade.gymId === (session?.initialGymId ?? null)));
      const selectedWallAngle = current.wallAnglePresetId
        ? wallAngles.find((wallAngle) => wallAngle.id === current.wallAnglePresetId) ?? null
        : null;
      const hasValidWallAngle = selectedWallAngle && !selectedWallAngle.isArchived;

      if ((current.gradeId === null || hasValidGrade) && (current.wallAnglePresetId === null || hasValidWallAngle)) {
        return current;
      }

      return {
        ...current,
        grade: current.gradeId && !hasValidGrade ? "Ungraded" : current.grade,
        gradeId: current.gradeId && !hasValidGrade ? null : current.gradeId,
        wallAngle: current.wallAnglePresetId && !hasValidWallAngle ? null : current.wallAngle,
        wallAnglePresetId: current.wallAnglePresetId && !hasValidWallAngle ? null : current.wallAnglePresetId,
      };
    });
  }, [grades, session?.initialGymId, wallAngles]);

  useEffect(() => {
    const nextWallDraft = getWallDraftFromSelection(wallSelection, boards);
    setClimbDraft((current) => {
      if (
        !current ||
        (current.wallType === nextWallDraft.wallType &&
          current.wallBoardId === nextWallDraft.wallBoardId &&
          current.wallLabel === nextWallDraft.wallLabel)
      ) {
        return current;
      }
      return {
        ...current,
        ...nextWallDraft,
        grade: "Ungraded",
        gradeId: null,
        wallAngle: null,
        wallAnglePresetId: null,
      };
    });
  }, [boards, selectedClimbForDraft?.id, wallSelection.wallBoardId, wallSelection.wallType]);

  useEffect(() => {
    if (
      wallSelection.wallType === "board" &&
      wallSelection.wallBoardId &&
      !activeBoards.some((board) => board.id === wallSelection.wallBoardId)
    ) {
      setStoreCurrentWallSelection({ wallType: "gym", wallBoardId: null });
      setError(null);
    }
  }, [activeBoards, setStoreCurrentWallSelection, wallSelection.wallBoardId, wallSelection.wallType]);

  const currentClimb = climbs.find((climb) => climb.id === currentClimbId) ?? null;
  const activeAttempt = attempts.find(isActiveAttempt) ?? null;
  const activeStrengthSet = strengthSets.find((set) => set.endedAt === null) ?? null;
  const currentClimbActiveAttempt = currentClimb
    ? attempts.find((attempt) => attempt.climbId === currentClimb.id && isActiveAttempt(attempt)) ?? null
    : null;
  const hasCompletedAttemptForCurrentClimb = currentClimb
    ? attempts.some((attempt) => attempt.climbId === currentClimb.id && !isActiveAttempt(attempt))
    : false;
  const currentClimbAttemptCount = currentClimb ? getAttemptCount(attempts, currentClimb.id) : 0;
  const shouldStartNewClimb =
    Boolean(
      currentClimb &&
        climbDraft &&
        shouldTreatIdentityDraftAsNewClimb(
          isClimbIdentityDraftDirty(currentClimb, climbDraft),
          hasCompletedAttemptForCurrentClimb,
          Boolean(currentClimbActiveAttempt),
        ),
    );

  useEffect(() => {
    if (!currentClimb || !climbDraft) {
      return;
    }
    const identityDirty = isClimbIdentityDraftDirty(currentClimb, climbDraft);
    const memoDirty = isClimbMemoDraftDirty(currentClimb, climbDraft);
    if (!identityDirty && !memoDirty) {
      return;
    }
    const canUpdateIdentity = canAutosaveClimbIdentity(hasCompletedAttemptForCurrentClimb, Boolean(currentClimbActiveAttempt));
    if (identityDirty && !canUpdateIdentity && !memoDirty) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const updateSource = identityDirty && canUpdateIdentity ? climbDraft : createClimbDraft(currentClimb);
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
        .then((updatedClimb) => {
          upsertClimb(updatedClimb);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Could not update climb.");
        });
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [
    climbDraft,
    currentClimb,
    currentClimbActiveAttempt,
    hasCompletedAttemptForCurrentClimb,
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
  const pendingEffortAttempt = pendingEffortAttemptId
    ? attempts.find((attempt) => attempt.id === pendingEffortAttemptId) ?? null
    : null;
  const pendingStrengthSet = pendingStrengthSetId
    ? strengthSets.find((strengthSet) => strengthSet.id === pendingStrengthSetId) ?? null
    : null;
  const selectedStrengthSet = selectedStrengthSetId ? strengthSets.find((strengthSet) => strengthSet.id === selectedStrengthSetId) ?? null : null;
  const selectedStrengthSetMatchesDraft = selectedStrengthSet ? trainingDraftMatchesStrengthSet(trainingDraft, selectedStrengthSet) : false;
  const visibleStrengthSet = activeStrengthSet ?? pendingStrengthSet ?? (selectedStrengthSetMatchesDraft ? selectedStrengthSet : null);
  const currentTrainingIdentity = visibleStrengthSet ?? trainingDraftToStrengthSetIdentity(trainingDraft);
  const currentTrainingSetCount = getCompletedStrengthSetCountForIdentity(strengthSets, currentTrainingIdentity);
  const currentTrainingIntervalSince = activeStrengthSet?.startedAt ?? getLastCompletedPhysicalActivityEnd(attempts, strengthSets) ?? activeSession.startedAt;
  const isFinishingCurrentAttempt = finishingAttemptId !== null && finishingAttemptId === currentClimbActiveAttempt?.id;
  const isFinishingStrengthSet = finishingStrengthSetId !== null && finishingStrengthSetId === activeStrengthSet?.id;
  const shouldShowTrainingCard = Boolean(isTrainingDraftOpen || activeStrengthSet || pendingStrengthSet || selectedStrengthSetId);
  const trainingDraftError = getTrainingDraftError(trainingDraft);
  const editingAttempt = attempts.find((attempt) => attempt.id === editingAttemptId) ?? null;
  const editingStrengthSet = strengthSets.find((set) => set.id === editingStrengthSetId) ?? null;
  const restStartedAt = getLastCompletedPhysicalActivityEnd(attempts, strengthSets) ?? activeSession.startedAt;
  const initialWallAnglePreset = getReusableWallAnglePreset(climbs, activeSession.initialGymId ?? null, wallAngles);
  const strengthNameSuggestions = getStrengthNameSuggestions(strengthSets);
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
      const sourceWallType = wallSelection.wallType;
      const sourceWallBoardId = wallSelection.wallBoardId;
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
    setSelectedStrengthSetId(null);
    setIsTrainingDraftOpen(false);
    setCurrentActivityType("climb");
    const selectedClimb = climbs.find((climb) => climb.id === climbId) ?? null;
    if (selectedClimb) {
      setStoreCurrentWallSelection(getWallSelectionForClimb(selectedClimb));
    }
    setStoreCurrentClimbId(climbId);
  }

  function handleStartTrainingDraft() {
    setError(null);
    setSelectedStrengthSetId(null);
    setTrainingDraft({ name: "", weight: "", reps: "", workDurationSeconds: "", memo: "" });
    setIsTrainingDraftOpen(true);
  }

  async function handleStartAttempt() {
    if (!sessionId || !currentClimb || !climbDraft) {
      return;
    }
    setError(null);
    try {
      let targetClimbId = currentClimb.id;
      if (isClimbIdentityDraftDirty(currentClimb, climbDraft)) {
        if (!hasCompletedAttemptForCurrentClimb) {
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
            null,
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

  async function handleStartStrengthSet() {
    if (!sessionId) {
      return;
    }
    setError(null);
    try {
      const strengthSet = await startStrengthSet(sessionId, {
        name: trainingDraft.name,
        weight: parseWeightInput(trainingDraft.weight),
        reps: parseRepsInput(trainingDraft.reps),
        workDurationSeconds: parseWorkDurationInput(trainingDraft.workDurationSeconds),
        memo: trainingDraft.memo,
      });
      upsertStrengthSet(strengthSet);
      setSelectedStrengthSetId(strengthSet.id);
      setIsTrainingDraftOpen(true);
      setCurrentActivityType("training");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start strength sets.");
    }
  }

  async function handleUpdateTrainingDraft(update: Partial<TrainingDraft>) {
    const hasLiveStrengthSet = Boolean(activeStrengthSet || pendingStrengthSet);
    const normalizedUpdate = normalizeTrainingDraftUpdate(trainingDraft, update, strengthSets, hasLiveStrengthSet);
    setTrainingDraft((current) => ({ ...current, ...normalizedUpdate }));
    if (!hasLiveStrengthSet && selectedStrengthSetId) {
      setSelectedStrengthSetId(null);
    }
    const targetStrengthSet = activeStrengthSet;
    if (!targetStrengthSet || pendingStrengthSet) {
      return;
    }
    try {
      const nextDraft = { ...trainingDraft, ...normalizedUpdate };
      const strengthSet = await updateStrengthSet(targetStrengthSet.id, {
        name: nextDraft.name,
        weight: parseWeightInput(nextDraft.weight),
        reps: parseRepsInput(nextDraft.reps),
        workDurationSeconds: parseWorkDurationInput(nextDraft.workDurationSeconds),
        memo: nextDraft.memo,
      });
      upsertStrengthSet(strengthSet);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update strength sets.");
    }
  }

  async function handleFinishStrengthSet() {
    if (!activeStrengthSet) {
      return;
    }
    setError(null);
    setFinishingStrengthSetId(activeStrengthSet.id);
    try {
      const strengthSet = await finishStrengthSet(activeStrengthSet.id);
      upsertStrengthSet(strengthSet);
      setPendingStrengthSetId(strengthSet.id);
      setPendingEffort(strengthSet.effort ?? 4);
      setTrainingDraft(strengthSetToDraft(strengthSet));
      setFinishingStrengthSetId(null);
    } catch (err) {
      setFinishingStrengthSetId(null);
      setError(err instanceof Error ? err.message : "Could not finish strength sets.");
    }
  }

  async function handleCancelStrengthSet() {
    if (!activeStrengthSet || !window.confirm("Cancel these active strength sets?")) {
      return;
    }
    setError(null);
    try {
      await cancelStrengthSet(activeStrengthSet.id);
      removeStrengthSet(activeStrengthSet.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel strength sets.");
    }
  }

  async function handleSavePendingStrengthSet() {
    if (!pendingStrengthSetId) {
      return;
    }
    setError(null);
    try {
      const strengthSet = await updateStrengthSetMetadata(pendingStrengthSetId, skipEffort ? null : pendingEffort, trainingDraft.memo);
      upsertStrengthSet(strengthSet);
      setPendingStrengthSetId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save strength sets.");
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

  async function handleDeleteStrengthSet(strengthSetId: string) {
    await deleteStrengthSet(strengthSetId);
    removeStrengthSet(strengthSetId);
    if (selectedStrengthSetId === strengthSetId) {
      setSelectedStrengthSetId(null);
      setIsTrainingDraftOpen(false);
    }
  }

  async function handleSaveStrengthSet(strengthSetId: string, update: Parameters<typeof updateStrengthSet>[1]) {
    const strengthSet = await updateStrengthSet(strengthSetId, update);
    upsertStrengthSet(strengthSet);
    if (selectedStrengthSetId === strengthSetId) {
      setTrainingDraft(strengthSetToDraft(strengthSet));
    }
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
              setError(null);
              if (event.target.value === "gym") {
                setStoreCurrentWallSelection({ wallType: "gym", wallBoardId: null });
                return;
              }
              setStoreCurrentWallSelection({ wallType: "board", wallBoardId: event.target.value.replace("board:", "") });
            }}
          >
            <option value="gym">Gym Wall</option>
            {activeBoards.length > 0 && <option disabled>────────</option>}
            {activeBoards.map((board) => (
              <option key={board.id} value={`board:${board.id}`}>
                {board.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel current-climb">
        <div className="section-heading">
          <p className="current-climb-title">Current Action</p>
          {shouldStartNewClimb && <p className="muted compact new-climb-hint">Changes will start a new climb.</p>}
        </div>
        <div className="activity-switch">
          <button
            type="button"
            className={currentActivityType === "climb" ? "selected" : ""}
            onClick={() => setCurrentActivityType("climb")}
          >
            CLIMB
          </button>
          <button
            type="button"
            className={currentActivityType === "training" ? "selected" : ""}
            onClick={() => setCurrentActivityType("training")}
          >
            TRAINING
          </button>
        </div>
        {currentActivityType === "climb" && currentClimb ? (
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
              <div className="climb-stats-layout">
                <div className="climb-stat-card">
                  <span className="metric-label">Attempts</span>
                  <strong>{getAttemptCount(attempts, currentClimb.id)}</strong>
                </div>
                <div className="climb-stat-card">
                  <span className="metric-label">Interval</span>
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
                    placeholder="Climb memo"
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
                      placeholder="Attempt memo"
                      onChange={(event) => setPendingAttemptNote(event.target.value)}
                    />
                  </label>
                  <button className="primary full" disabled={Boolean(finishingAttemptId)} onClick={handleSavePendingEffort}>
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
                  <button className="primary climb-start-button" disabled={Boolean(activeAttempt || activeStrengthSet)} onClick={handleStartAttempt}>
                    START
                  </button>
                </>
              )}
            </div>
          </div>
        ) : currentActivityType === "climb" ? (
          <button className="primary full" onClick={handleAddClimb}>
            Start Climb
          </button>
        ) : !shouldShowTrainingCard ? (
          <button className="primary full" onClick={handleStartTrainingDraft}>
            Start Training
          </button>
        ) : (
          <CurrentTrainingCard
            draft={trainingDraft}
            activeStrengthSet={activeStrengthSet}
            pendingStrengthSet={pendingStrengthSet}
            suggestions={strengthNameSuggestions}
            isBusy={isFinishingStrengthSet}
            pendingEffort={pendingEffort}
            setCount={currentTrainingSetCount}
            intervalSince={currentTrainingIntervalSince}
            skipEffort={skipEffort}
            hasBlockingAttempt={Boolean(activeAttempt)}
            validationMessage={trainingDraftError}
            onDraftChange={handleUpdateTrainingDraft}
            onStart={handleStartStrengthSet}
            onFinish={handleFinishStrengthSet}
            onCancel={handleCancelStrengthSet}
            onEffortChange={setPendingEffort}
            onSkipEffortChange={setSkipEffort}
            onSaveMetadata={handleSavePendingStrengthSet}
          />
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <ClimbList
        climbs={orderedClimbs}
        attempts={attempts}
        strengthSets={strengthSets}
        gyms={gyms}
        currentClimbId={currentActivityType === "climb" ? currentClimbId : null}
        currentStrengthSetId={currentActivityType === "training" ? selectedStrengthSetId : null}
        onSelect={handleSelectClimb}
        onSelectStrength={(strengthSet) => {
          setSelectedStrengthSetId(strengthSet.id);
          setIsTrainingDraftOpen(true);
          setTrainingDraft(strengthSetToDraft(strengthSet));
          setCurrentActivityType("training");
        }}
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

      {editingStrengthSet && (
        <StrengthSetEditor
          key={editingStrengthSet.id}
          strengthSet={editingStrengthSet}
          sessionStartedAt={activeSession.startedAt}
          sessionEndedAt={activeSession.endedAt}
          onCancel={() => setEditingStrengthSetId(null)}
          onDelete={handleDeleteStrengthSet}
          onSave={handleSaveStrengthSet}
        />
      )}

      <AttemptTimeline
        attempts={attempts}
        strengthSets={strengthSets}
        climbs={climbs}
        gyms={gyms}
        onEdit={(attempt) => setEditingAttemptId(attempt.id)}
        onEditStrength={(strengthSet) => setEditingStrengthSetId(strengthSet.id)}
      />

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
  const gradeOptions = getGradeOptionsForSelect(draft.gradeId, draft.grade, grades);
  const gradeSelectValue = getGradeSelectValue(draft.gradeId, draft.grade, gradeOptions);
  const angleOptions = getWallAngleOptionsForSelect(draft.wallAnglePresetId, draft.wallAngle, wallAngles);
  const wallAngleSelectValue = getWallAngleSelectValue(draft.wallAnglePresetId, draft.wallAngle, angleOptions);
  const gradeDisplay = gradeOptions.find((grade) => grade.id === gradeSelectValue)?.label ?? "Select";
  const wallAngleDisplay = angleOptions.find((angle) => angle.id === wallAngleSelectValue)?.label ?? "No angle";
  const hasGradeValue = gradeSelectValue !== "";
  const hasWallAngleValue = draft.wallAngle !== null;
  const wallDisplay = getWallDisplayName(draft, boards);
  return (
    <div className="editable-climb-card">
      <div className="climb-field-row">
        <label className="select-chip climb-field-grade">
          <strong className={hasGradeValue ? "grade-value" : "chip-placeholder"}>{hasGradeValue ? gradeDisplay : "Select Grade"}</strong>
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
        <label className="select-chip climb-field-angle angle-chip">
          <strong className={hasWallAngleValue ? "angle-value" : undefined}>{wallAngleDisplay}</strong>
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
      <label className="climb-text-chip">
        <input
          key={climb.id}
          value={draft.name}
          placeholder="Name / Number"
          onChange={(event) => onDraftChange({ name: event.target.value })}
        />
      </label>
      <div className="select-chip readonly-chip">
        <strong>{wallDisplay}</strong>
      </div>
      {isAddingWallAngle && (
        <form
          className="wall-angle-popover"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              const parsedAngle = parseWallAngleInput(newWallAngle);
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
            placeholder="Wall angle"
            aria-label="New wall angle"
          />
          <span>°</span>
          <button type="submit" className="primary">Add</button>
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

function CurrentTrainingCard({
  draft,
  activeStrengthSet,
  pendingStrengthSet,
  suggestions,
  isBusy,
  pendingEffort,
  setCount,
  intervalSince,
  skipEffort,
  hasBlockingAttempt,
  validationMessage,
  onDraftChange,
  onStart,
  onFinish,
  onCancel,
  onEffortChange,
  onSkipEffortChange,
  onSaveMetadata,
}: {
  draft: TrainingDraft;
  activeStrengthSet: StrengthSet | null;
  pendingStrengthSet: StrengthSet | null;
  suggestions: string[];
  isBusy: boolean;
  pendingEffort: AttemptEffort;
  setCount: number;
  intervalSince: string | null;
  skipEffort: boolean;
  hasBlockingAttempt: boolean;
  validationMessage: string | null;
  onDraftChange: (update: Partial<TrainingDraft>) => void;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onEffortChange: (effort: AttemptEffort) => void;
  onSkipEffortChange: (skip: boolean) => void;
  onSaveMetadata: () => void;
}) {
  return (
    <div className="current-climb-card current-training-card">
      <div className="training-grid">
        <label className="climb-text-chip training-name-chip">
          <input
            value={draft.name}
            list="strength-name-suggestions"
            placeholder="Exercise name"
            onChange={(event) => onDraftChange({ name: event.target.value })}
          />
        </label>
        <datalist id="strength-name-suggestions">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <label className="select-chip training-input-chip">
          <span className="metric-label">Weight kg</span>
          <input inputMode="decimal" value={draft.weight} placeholder="Weight" onChange={(event) => onDraftChange({ weight: event.target.value })} />
        </label>
        <label className="select-chip training-input-chip">
          <span className="metric-label">Reps</span>
          <input inputMode="numeric" value={draft.reps} placeholder="Reps" onChange={(event) => onDraftChange({ reps: event.target.value })} />
        </label>
        <label className="select-chip training-input-chip">
          <span className="metric-label">Work sec</span>
          <input
            inputMode="decimal"
            value={draft.workDurationSeconds}
            placeholder="Seconds"
            onChange={(event) => onDraftChange({ workDurationSeconds: event.target.value })}
          />
        </label>
      </div>
      <div className="climb-stats-layout training-derived-layout">
        <div className="climb-stat-card">
          <span className="metric-label">Sets</span>
          <strong>{setCount}</strong>
        </div>
        <div className="climb-stat-card">
          <span className="metric-label">Interval</span>
          <strong>
            {intervalSince ? <IntervalTimer since={intervalSince} /> : "--"}
          </strong>
        </div>
      </div>
      <label className="climb-memo-field">
        Memo
        <textarea
          value={draft.memo}
          placeholder="Training memo"
          onChange={(event) => onDraftChange({ memo: event.target.value })}
        />
      </label>
      {validationMessage && <p className="error compact">{validationMessage}</p>}

      {pendingStrengthSet ? (
        <div className="post-attempt-effort">
          <div className="section-heading">
            <span className="label">Effort</span>
            <label className="skip-effort-toggle">
              <input type="checkbox" checked={skipEffort} onChange={(event) => onSkipEffortChange(event.target.checked)} />
              Skip
            </label>
          </div>
          {skipEffort ? <p className="muted compact">Effort will not be recorded.</p> : <EffortInput value={pendingEffort} onChange={onEffortChange} />}
          <label className="attempt-note-field">
            Memo
            <textarea
              value={draft.memo}
              placeholder="Training memo"
              onChange={(event) => onDraftChange({ memo: event.target.value })}
            />
          </label>
          <button className="primary full" onClick={onSaveMetadata}>
            Save
          </button>
        </div>
      ) : activeStrengthSet ? (
        <div className="attempt-action-grid">
          <button className="primary full" disabled={isBusy} onClick={onFinish}>
            FINISH
          </button>
          <button className="secondary full" disabled={isBusy} onClick={onCancel}>
            Cancel Sets
          </button>
        </div>
      ) : (
        <button className="primary climb-start-button" disabled={Boolean(hasBlockingAttempt || validationMessage)} onClick={onStart}>
          START
        </button>
      )}
    </div>
  );
}

function trainingDraftToStrengthSetIdentity(draft: TrainingDraft): StrengthSetIdentity | null {
  try {
    return {
      name: draft.name,
      weight: parseWeightInput(draft.weight),
      reps: parseRepsInput(draft.reps),
      workDurationSeconds: parseWorkDurationInput(draft.workDurationSeconds),
    };
  } catch {
    return null;
  }
}

function trainingDraftMatchesStrengthSet(draft: TrainingDraft, strengthSet: StrengthSet): boolean {
  const identity = trainingDraftToStrengthSetIdentity(draft);
  return identity ? getStrengthSetCardKey(identity) === getStrengthSetCardKey(strengthSet) : false;
}

function normalizeTrainingDraftUpdate(
  currentDraft: TrainingDraft,
  update: Partial<TrainingDraft>,
  strengthSets: StrengthSet[],
  hasSavedTarget: boolean,
): Partial<TrainingDraft> {
  if (update.name === undefined || update.name === currentDraft.name || hasSavedTarget) {
    return update;
  }

  const latestSet = getLatestStrengthSetByName(strengthSets, update.name);
  if (latestSet) {
    return {
      ...strengthSetToDraft(latestSet),
      name: update.name,
    };
  }

  return {
    ...update,
    weight: "",
    reps: "",
    workDurationSeconds: "",
    memo: "",
  };
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

function strengthSetToDraft(strengthSet: StrengthSet): TrainingDraft {
  return {
    name: strengthSet.name,
    weight: strengthSet.weight === null || strengthSet.weight === undefined ? "" : String(strengthSet.weight),
    reps: strengthSet.reps === null || strengthSet.reps === undefined ? "" : String(strengthSet.reps),
    workDurationSeconds:
      strengthSet.workDurationSeconds === null || strengthSet.workDurationSeconds === undefined
        ? ""
        : String(strengthSet.workDurationSeconds),
    memo: strengthSet.memo ?? "",
  };
}

function parseWeightInput(value: string): number | null {
  return parseOptionalNumericInput(value, { label: "Weight", min: 0 });
}

function parseRepsInput(value: string): number | null {
  return parseOptionalNumericInput(value, { label: "Reps", integer: true, min: 0 });
}

function parseWorkDurationInput(value: string): number | null {
  return parseOptionalNumericInput(value, { label: "Work duration", min: 0 });
}

function parseWallAngleInput(value: string): number {
  return parseOptionalNumericInput(value, { label: "Wall angle", required: true, min: 0, max: 180 }) ?? 0;
}

function getTrainingDraftError(draft: TrainingDraft): string | null {
  return (
    getOptionalNumericInputError(draft.weight, { label: "Weight", min: 0 }) ??
    getOptionalNumericInputError(draft.reps, { label: "Reps", integer: true, min: 0 }) ??
    getOptionalNumericInputError(draft.workDurationSeconds, { label: "Work duration", min: 0 })
  );
}

function getWallDraftFromSelection(wallSelection: WallSelection, boards: Board[]): Pick<ClimbDraft, "wallType" | "wallBoardId" | "wallLabel"> {
  if (wallSelection.wallType === "board" && wallSelection.wallBoardId) {
    const board = boards.find((item) => item.id === wallSelection.wallBoardId) ?? null;
    return {
      wallType: "board",
      wallBoardId: wallSelection.wallBoardId,
      wallLabel: board?.name ?? null,
    };
  }

  return {
    wallType: "gym",
    wallBoardId: null,
    wallLabel: "Gym Wall",
  };
}

function getWallSelectionForClimb(climb: Climb): WallSelection {
  return {
    wallType: climb.wallType ?? "gym",
    wallBoardId: climb.wallType === "board" ? climb.wallBoardId ?? null : null,
  };
}

function getWallDisplayName(draft: ClimbDraft, boards: Board[]): string {
  if (draft.wallType === "board" && draft.wallBoardId) {
    return draft.wallLabel ?? boards.find((board) => board.id === draft.wallBoardId)?.name ?? "Board";
  }
  return "Gym Wall";
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

export function canAutosaveClimbIdentity(hasCompletedAttempt: boolean, hasActiveAttempt: boolean): boolean {
  return !hasCompletedAttempt || hasActiveAttempt;
}

export function shouldTreatIdentityDraftAsNewClimb(
  identityDirty: boolean,
  hasCompletedAttempt: boolean,
  hasActiveAttempt: boolean,
): boolean {
  return identityDirty && hasCompletedAttempt && !hasActiveAttempt;
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
