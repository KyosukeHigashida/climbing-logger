import { useLiveQuery } from "dexie-react-hooks";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SessionTimer } from "../components/SessionTimer";
import {
  createSession,
  exportAllData,
  getActiveSession,
  getActiveGyms,
  getAllAttempts,
  getAllGyms,
  getAllSessions,
  restoreAllData,
} from "../db/repository";
import { getAttemptCount } from "../utils/attempts";
import { qaItems } from "../utils/qa";
import { requestPersistentStorage } from "../utils/storage";
import { formatSessionDuration, formatShortDate } from "../utils/time";

export function HomePage() {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [isQaOpen, setIsQaOpen] = useState(false);
  const sessions = useLiveQuery(() => getAllSessions(), []);
  const attempts = useLiveQuery(() => getAllAttempts(), []);
  const activeSession = useLiveQuery(() => getActiveSession(), []);
  const gyms = useLiveQuery(() => getActiveGyms(), []);
  const allGyms = useLiveQuery(() => getAllGyms(), []);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  if (!sessions || !attempts || activeSession === undefined || !gyms || !allGyms) {
    return <main className="app-shell loading">Loading climbing log...</main>;
  }

  const completedSessions = sessions.filter((session) => session.endedAt !== null);
  const gymById = new Map(allGyms.map((gym) => [gym.id, gym]));

  async function handleStartSession() {
    if (!selectedGymId) {
      window.alert("Select a gym before starting a session.");
      return;
    }

    try {
      const session = await createSession(selectedGymId);
      navigate(`/session/${session.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not start session.");
    }
  }

  async function handleExportData() {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `climbing-log-backup-${data.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not export data.");
    }
  }

  async function handleImportData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const firstConfirm = window.confirm(
      "Restore this backup? This will replace all current local Climbing Log data on this device.",
    );
    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm("This cannot be undone unless you have another export. Continue restore?");
    if (!secondConfirm) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const restored = await restoreAllData(parsed);
      setRestoreMessage(
        `Restored ${restored.gyms.length} gyms, ${restored.grades.length} grades, ${restored.sessions.length} sessions, ${restored.climbs.length} climbs, ${restored.attempts.length} attempts.`,
      );
    } catch (err) {
      setRestoreMessage(err instanceof Error ? err.message : "Could not restore backup.");
    }
  }

  return (
    <main className="app-shell">
      <header className="home-hero">
        <div>
          <p className="eyebrow">Bouldering tracker</p>
          <h1>Climbing Log</h1>
        </div>
        <button className="qa-button" onClick={() => setIsQaOpen(true)}>
          Q&A
        </button>
      </header>

      {activeSession ? (
        <section className="panel">
          <div className="panel-row">
            <div>
              <p className="label">Session in progress</p>
              <div className="large-timer">
                <SessionTimer startedAt={activeSession.startedAt} />
              </div>
            </div>
          </div>
          <button className="primary full" onClick={() => navigate(`/session/${activeSession.id}`)}>
            CONTINUE SESSION
          </button>
        </section>
      ) : (
        <section className="panel new-session-panel">
          <label>
            Gym
            <select value={selectedGymId} onChange={(event) => setSelectedGymId(event.target.value)}>
              <option value="">Select Gym</option>
              {gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary start-button" onClick={handleStartSession}>
            START SESSION
          </button>
          <button className="secondary full manage-link-button" onClick={() => navigate("/gyms")}>
            + Add Gym
          </button>
          <button className="secondary full manage-link-button" onClick={() => navigate("/boards")}>
            + Add Board
          </button>
        </section>
      )}

      {isQaOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Q&A">
          <div className="modal-panel">
            <div className="section-heading">
              <h2>Q&A</h2>
              <button className="small-text-action" onClick={() => setIsQaOpen(false)}>
                Close
              </button>
            </div>
            <div className="qa-list">
              {qaItems.map((item) => (
                <article key={item.id} className="qa-item">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <h2>Recent Sessions</h2>
        {completedSessions.length === 0 ? (
          <p className="empty">Completed sessions will stay here.</p>
        ) : (
          <div className="session-list">
            {completedSessions.slice(0, 8).map((session) => {
              const attemptCount = getAttemptCount(attempts.filter((attempt) => attempt.sessionId === session.id));
              const gymName = session.initialGymId ? gymById.get(session.initialGymId)?.name ?? "Unknown Gym" : "No Gym";
              return (
                <button
                  className="session-row"
                  key={session.id}
                  onClick={() => navigate(`/session/${session.id}/summary`)}
                >
                  <span>
                    <strong>{formatShortDate(session.startedAt)}</strong>
                    <small>{gymName}</small>
                    <small>{formatSessionDuration(session.startedAt, session.endedAt)}</small>
                  </span>
                  <span className="muted">{attemptCount} attempts</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="section utility-section">
        <h2>Backup</h2>
        <button className="secondary full" onClick={handleExportData}>
          Export all data
        </button>
        <input
          ref={importInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={handleImportData}
        />
        <button className="secondary full backup-action" onClick={() => importInputRef.current?.click()}>
          Restore from JSON
        </button>
        {restoreMessage && <p className="restore-message">{restoreMessage}</p>}
      </section>
    </main>
  );
}
