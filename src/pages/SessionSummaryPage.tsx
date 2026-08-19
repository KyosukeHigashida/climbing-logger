import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AttemptEditor } from "../components/AttemptEditor";
import { AttemptTimeline } from "../components/AttemptTimeline";
import { useActiveSession } from "../context/ActiveSessionContext";
import {
  deleteAttempt,
  getAllGyms,
  getSession,
  getSessionAttempts,
  getSessionClimbs,
  reopenSession,
  updateAttempt,
} from "../db/repository";
import type { Attempt, Climb, Gym, Session } from "../types/domain";
import { getFailCount, getSendCount } from "../utils/attempts";
import { formatSessionDuration } from "../utils/time";
import { useState } from "react";

export function SessionSummaryPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const activeSessionStore = useActiveSession();
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
  const gyms = useLiveQuery<Gym[]>(() => getAllGyms(), []);

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
