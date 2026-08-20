import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AttemptEditor } from "../components/AttemptEditor";
import { AttemptTimeline } from "../components/AttemptTimeline";
import { ScaleInput } from "../components/ScaleInput";
import { useActiveSession } from "../context/ActiveSessionContext";
import {
  deleteAttempt,
  getAllGyms,
  getSession,
  getSessionAttempts,
  getSessionClimbs,
  reopenSession,
  updateAttempt,
  updateSessionReview,
} from "../db/repository";
import type { Attempt, Climb, Gym, Session } from "../types/domain";
import { getFailCount, getSendCount } from "../utils/attempts";
import { formatSessionDuration } from "../utils/time";
import { useEffect, useState } from "react";

export function SessionSummaryPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const activeSessionStore = useActiveSession();
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [hasSessionRpe, setHasSessionRpe] = useState(false);
  const [sessionRpe, setSessionRpe] = useState(5);
  const [hasPerformance, setHasPerformance] = useState(false);
  const [performance, setPerformance] = useState(3);
  const [memo, setMemo] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
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

  useEffect(() => {
    if (!session) {
      return;
    }
    setHasSessionRpe(session.sessionRpe !== undefined && session.sessionRpe !== null ? true : readReviewCheckboxDefault("sessionRpe"));
    setSessionRpe(session.sessionRpe ?? 5);
    setHasPerformance(session.performance !== undefined && session.performance !== null ? true : readReviewCheckboxDefault("performance"));
    setPerformance(session.performance ?? 3);
    setMemo(session.memo ?? "");
  }, [session?.id, session?.sessionRpe, session?.performance, session?.memo]);

  useEffect(() => {
    setReviewMessage(null);
  }, [sessionId]);

  if (session === undefined || !climbs || !attempts || !gyms) {
    return <main className="app-shell loading">Loading summary...</main>;
  }

  if (!sessionId || session === null) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Session not found</h1>
          <p className="muted">This summary URL does not match saved data.</p>
          <Link className="primary link-button" to="/">
            Back Home
          </Link>
        </section>
      </main>
    );
  }

  const sends = getSendCount(attempts);
  const fails = getFailCount(attempts);
  const editingAttempt = attempts.find((attempt) => attempt.id === editingAttemptId) ?? null;

  async function handleReopenSession() {
    if (!sessionId || !window.confirm("Reopen this completed session?")) {
      return;
    }

    await reopenSession(sessionId);
    await activeSessionStore.refreshSession(sessionId);
    navigate(`/session/${sessionId}`);
  }

  async function handleSaveReview() {
    if (!sessionId) {
      return;
    }

    setIsSavingReview(true);
    setReviewMessage(null);
    try {
      await updateSessionReview(sessionId, {
        sessionRpe: hasSessionRpe ? sessionRpe : null,
        performance: hasPerformance ? performance : null,
        memo,
      });
      setReviewMessage("Review saved.");
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Could not save review.");
    } finally {
      setIsSavingReview(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="session-header">
        <div>
          <p className="eyebrow">Session Complete</p>
          <h1>Summary</h1>
        </div>
        <Link to="/" className="ghost-link">
          Home
        </Link>
      </header>

      <section className="panel summary-panel">
        <div>
          <span className="metric-label">Duration</span>
          <strong>{formatSessionDuration(session.startedAt, session.endedAt)}</strong>
        </div>
        <div>
          <span className="metric-label">Attempts</span>
          <strong>{attempts.length}</strong>
        </div>
        <div>
          <span className="metric-label">Sends</span>
          <strong>{sends}</strong>
        </div>
        <div>
          <span className="metric-label">Fails</span>
          <strong>{fails}</strong>
        </div>
        <div>
          <span className="metric-label">Climbs</span>
          <strong>{climbs.length}</strong>
        </div>
      </section>

      <section className="panel session-review-panel">
        <div className="section-heading">
          <div>
            <p className="label">SESSION REVIEW</p>
            <h2>How did this session feel?</h2>
          </div>
        </div>

        <div className="review-scale-card">
          <label className="review-toggle">
            <input
              type="checkbox"
              checked={hasSessionRpe}
              onChange={(event) => {
                setHasSessionRpe(event.target.checked);
                writeReviewCheckboxDefault("sessionRpe", event.target.checked);
              }}
            />
            Session RPE
          </label>
          <p className="muted">How hard was the whole session?</p>
          {hasSessionRpe ? (
            <ScaleInput
              min={0}
              max={10}
              value={sessionRpe}
              valueLabel={`RPE ${sessionRpe}`}
              labels={[
                { value: 0, label: "None" },
                { value: 10, label: "Maximal" },
              ]}
              ariaLabel="Session RPE"
              onChange={setSessionRpe}
            />
          ) : (
            <p className="muted">Not recorded.</p>
          )}
        </div>

        <div className="review-scale-card">
          <label className="review-toggle">
            <input
              type="checkbox"
              checked={hasPerformance}
              onChange={(event) => {
                setHasPerformance(event.target.checked);
                writeReviewCheckboxDefault("performance", event.target.checked);
              }}
            />
            Performance
          </label>
          <p className="muted">Compared with your usual level.</p>
          {hasPerformance ? (
            <ScaleInput
              min={1}
              max={5}
              value={performance}
              valueLabel={performanceLabels[performance]}
              labels={[
                { value: 1, label: "Poor" },
                { value: 3, label: "Normal" },
                { value: 5, label: "Great" },
              ]}
              ariaLabel="Session performance"
              onChange={setPerformance}
            />
          ) : (
            <p className="muted">Not recorded.</p>
          )}
        </div>

        <label className="review-memo-field">
          Memo
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Session notes" />
        </label>

        <button className="primary full" onClick={handleSaveReview} disabled={isSavingReview}>
          {isSavingReview ? "Saving..." : "SAVE REVIEW"}
        </button>
        {reviewMessage && <p className="muted">{reviewMessage}</p>}
      </section>

      <button className="secondary full reopen-session-button" onClick={handleReopenSession}>
        REOPEN SESSION
      </button>

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
    </main>
  );
}

const performanceLabels: Record<number, string> = {
  1: "Very poor",
  2: "Below normal",
  3: "Normal",
  4: "Above normal",
  5: "Very good",
};

type ReviewCheckboxKey = "sessionRpe" | "performance";

const reviewCheckboxStorageKeys: Record<ReviewCheckboxKey, string> = {
  sessionRpe: "climbingLogger.sessionReview.hasSessionRpe",
  performance: "climbingLogger.sessionReview.hasPerformance",
};

function readReviewCheckboxDefault(key: ReviewCheckboxKey): boolean {
  return window.localStorage.getItem(reviewCheckboxStorageKeys[key]) === "true";
}

function writeReviewCheckboxDefault(key: ReviewCheckboxKey, value: boolean) {
  window.localStorage.setItem(reviewCheckboxStorageKeys[key], String(value));
}
