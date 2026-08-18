import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AttemptEditor } from "../components/AttemptEditor";
import { AttemptTimeline } from "../components/AttemptTimeline";
import {
  deleteAttempt,
  deleteSession,
  getSession,
  getSessionAttempts,
  getSessionClimbs,
  reopenSession,
  updateAttempt,
} from "../db/repository";
import type { Attempt, Climb, Session } from "../types/domain";
import { getFailCount, getSendCount } from "../utils/attempts";
import { formatSessionDuration, formatShortDate } from "../utils/time";
import { useState } from "react";

export function SessionSummaryPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
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

  if (session === undefined || !climbs || !attempts) {
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

  const loadedSession = session;
  const loadedClimbs = climbs;
  const loadedAttempts = attempts;
  const sends = getSendCount(attempts);
  const fails = getFailCount(attempts);
  const editingAttempt = attempts.find((attempt) => attempt.id === editingAttemptId) ?? null;

  async function handleReopenSession() {
    if (!sessionId || !window.confirm("Reopen this completed session?")) {
      return;
    }

    await reopenSession(sessionId);
    navigate(`/session/${sessionId}`);
  }

  async function handleDeleteSession() {
    if (!sessionId) {
      return;
    }

    const label = formatShortDate(loadedSession.startedAt);
    const firstConfirm = window.confirm(
      `Delete the ${label} session? This will permanently delete ${loadedAttempts.length} attempts and ${loadedClimbs.length} climbs.`,
    );
    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm("This cannot be undone. Delete this session permanently?");
    if (!secondConfirm) {
      return;
    }

    try {
      await deleteSession(sessionId);
      navigate("/");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete session.");
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

      <button className="secondary full" onClick={handleReopenSession}>
        Reopen Session
      </button>

      <button className="danger subtle-danger full" onClick={handleDeleteSession}>
        Delete Session
      </button>

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
    </main>
  );
}
