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
  getAllSessions,
  restoreAllData,
} from "../db/repository";
import { getAttemptCount } from "../utils/attempts";
import { requestPersistentStorage } from "../utils/storage";
import { formatSessionDuration, formatShortDate } from "../utils/time";

export function HomePage() {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const sessions = useLiveQuery(() => getAllSessions(), []);
  const attempts = useLiveQuery(() => getAllAttempts(), []);
  const activeSession = useLiveQuery(() => getActiveSession(), []);
  const gyms = useLiveQuery(() => getActiveGyms(), []);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  if (!sessions || !attempts || activeSession === undefined || !gyms) {
    return <main className="app-shell loading">Loading climbing log...</main>;
  }

  const completedSessions = sessions.filter((session) => session.endedAt !== null);

  async function handleStartSession() {
    try {
      const session = await createSession(selectedGymId || null);
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
        <p className="eyebrow">Bouldering tracker</p>
        <h1>Climbing Log</h1>
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
              <option value="">No gym</option>
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
            Manage Gyms
          </button>
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
              return (
                <button
                  className="session-row"
                  key={session.id}
                  onClick={() => navigate(`/session/${session.id}/summary`)}
                >
                  <span>
                    <strong>{formatShortDate(session.startedAt)}</strong>
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
