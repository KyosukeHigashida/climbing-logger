import { useLiveQuery } from "dexie-react-hooks";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SessionTimer } from "../components/SessionTimer";
import { useActiveSession } from "../context/ActiveSessionContext";
import {
  createSession,
  deleteSession,
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
import { colorThemes, type ColorThemeId } from "../utils/theme";
import { formatSessionDuration, formatShortDate } from "../utils/time";

type HomePageProps = {
  colorTheme?: ColorThemeId;
  onColorThemeChange?: (theme: ColorThemeId) => void;
};

export function HomePage({ colorTheme = "forest", onColorThemeChange = () => undefined }: HomePageProps) {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [isQaOpen, setIsQaOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditingSessions, setIsEditingSessions] = useState(false);
  const [isRecentSessionsExpanded, setIsRecentSessionsExpanded] = useState(true);
  const activeSessionStore = useActiveSession();
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
      void activeSessionStore.refreshSession(session.id);
      navigate(`/session/${session.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not start session.");
    }
  }

  async function handleContinueSession() {
    if (!activeSession) {
      return;
    }

    void activeSessionStore.refreshSession(
      activeSession.id,
      activeSessionStore.snapshot?.ui.currentClimbId ?? null,
      activeSessionStore.snapshot
        ? {
            wallType: activeSessionStore.snapshot.ui.currentWallType,
            wallBoardId: activeSessionStore.snapshot.ui.currentBoardId,
          }
        : null,
    );
    navigate(`/session/${activeSession.id}`);
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
        `Restored ${restored.gyms.length} gyms, ${restored.grades.length} grades, ${restored.sessions.length} sessions, ${restored.climbs.length} climbs, ${restored.attempts.length} attempts, ${restored.strengthSets.length} strength sets.`,
      );
    } catch (err) {
      setRestoreMessage(err instanceof Error ? err.message : "Could not restore backup.");
    }
  }

  async function handleDeleteSession(sessionId: string, label: string, attemptCount: number) {
    const firstConfirm = window.confirm(
      `Delete the ${label} session from the session list? This will permanently delete ${attemptCount} attempts and all climbs in that session.`,
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
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete session.");
    }
  }

  return (
    <main className="app-shell">
      <header className="home-hero">
        <div>
          <p className="eyebrow">Bouldering tracker</p>
          <h1>Climbing Log</h1>
        </div>
        <div className="home-hero-actions">
          <button className="settings-button" aria-label="Settings" title="Settings" onClick={() => setIsSettingsOpen(true)}>
            <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z" />
              <path d="M19.4 13.3c.1-.4.1-.9.1-1.3s0-.9-.1-1.3l2-1.5-2-3.5-2.4 1a8.5 8.5 0 0 0-2.2-1.3L14.5 3h-5l-.3 2.4A8.5 8.5 0 0 0 7 6.7l-2.4-1-2 3.5 2 1.5c-.1.4-.1.9-.1 1.3s0 .9.1 1.3l-2 1.5 2 3.5 2.4-1c.7.6 1.4 1 2.2 1.3l.3 2.4h5l.3-2.4c.8-.3 1.5-.7 2.2-1.3l2.4 1 2-3.5-2-1.5Z" />
            </svg>
          </button>
          <button className="qa-button" onClick={() => setIsQaOpen(true)}>
            Q&A
          </button>
        </div>
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
          <button className="primary full" onClick={() => void handleContinueSession()}>
            CONTINUE SESSION
          </button>
          <MasterDataActions onAddGym={() => navigate("/gyms")} onAddBoard={() => navigate("/boards")} />
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
          <MasterDataActions onAddGym={() => navigate("/gyms")} onAddBoard={() => navigate("/boards")} />
        </section>
      )}

      <section className="section home-history-section" aria-label="History">
        <div>
          <h2>History</h2>
        </div>
        <button className="secondary full" onClick={() => navigate("/history")}>
          Open History
        </button>
      </section>

      <section className="section home-history-section" aria-label="Statistics">
        <div>
          <h2>Stats</h2>
        </div>
        <button className="secondary full" onClick={() => navigate("/stats")}>
          Open Statistics
        </button>
      </section>

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

      {isSettingsOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="modal-panel">
            <div className="section-heading">
              <h2>Settings</h2>
              <button className="small-text-action" onClick={() => setIsSettingsOpen(false)}>
                Close
              </button>
            </div>
            <div className="theme-list" aria-label="Color theme">
              {colorThemes.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-option ${colorTheme === theme.id ? "selected" : ""}`}
                  onClick={() => onColorThemeChange(theme.id)}
                  aria-pressed={colorTheme === theme.id}
                >
                  <span className={`theme-swatch theme-swatch-${theme.id}`} aria-hidden="true" />
                  <span>{theme.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section recent-sessions-section" aria-label="Recent sessions">
        <div className="collapsible-heading">
          <button
            type="button"
            className="timeline-header recent-sessions-title-button"
            aria-expanded={isRecentSessionsExpanded}
            onClick={() => setIsRecentSessionsExpanded((current) => !current)}
          >
            <span>
              Recent Sessions <small>· {completedSessions.length}</small>
            </span>
          </button>
          {isRecentSessionsExpanded && completedSessions.length > 0 && (
            <button className="small-text-action" onClick={() => setIsEditingSessions((current) => !current)}>
              {isEditingSessions ? "Done" : "Edit"}
            </button>
          )}
          <button
            type="button"
            className="timeline-chevron recent-sessions-toggle"
            aria-label={isRecentSessionsExpanded ? "Collapse Recent Sessions" : "Expand Recent Sessions"}
            aria-expanded={isRecentSessionsExpanded}
            onClick={() => setIsRecentSessionsExpanded((current) => !current)}
          >
            {isRecentSessionsExpanded ? "⌃" : "⌄"}
          </button>
        </div>
        {isRecentSessionsExpanded && (
          completedSessions.length === 0 ? (
            <p className="empty">Completed sessions will stay here.</p>
          ) : (
            <div className="session-list">
              {completedSessions.slice(0, 8).map((session) => {
                const attemptCount = getAttemptCount(attempts.filter((attempt) => attempt.sessionId === session.id));
                const gymName = session.initialGymId ? gymById.get(session.initialGymId)?.name ?? "Unknown Gym" : "No Gym";
                const label = formatShortDate(session.startedAt);
                return (
                  <div className="session-row" key={session.id}>
                    <button className="session-open" onClick={() => navigate(`/session/${session.id}/summary`)}>
                      <span>
                        <strong>{label}</strong>
                        <small>{gymName}</small>
                        <small>{formatSessionDuration(session.startedAt, session.endedAt)}</small>
                      </span>
                      <span className="muted">{attemptCount} attempts</span>
                    </button>
                    {isEditingSessions && (
                      <button
                        className="session-delete-action"
                        aria-label={`Delete ${label} session`}
                        onClick={() => void handleDeleteSession(session.id, label, attemptCount)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
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

function MasterDataActions({ onAddGym, onAddBoard }: { onAddGym: () => void; onAddBoard: () => void }) {
  return (
    <div className="master-action-group">
      <button className="secondary full manage-link-button" onClick={onAddGym}>
        + Add Gym
      </button>
      <button className="secondary full manage-link-button" onClick={onAddBoard}>
        + Add Board
      </button>
    </div>
  );
}
