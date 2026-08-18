import { useLiveQuery } from "dexie-react-hooks";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  archiveGrade,
  archiveGym,
  createGrade,
  createGym,
  deleteGrade,
  deleteGym,
  getAllClimbs,
  getAllGyms,
  getAllSessions,
  getGymGrades,
  moveGrade,
  updateGrade,
  updateGym,
} from "../db/repository";
import type { Grade, Gym } from "../types/domain";

export function GymsPage() {
  const { gymId } = useParams();
  const navigate = useNavigate();
  const gyms = useLiveQuery(() => getAllGyms(), []);
  const grades = useLiveQuery<Grade[]>(() => (gymId ? getGymGrades(gymId, true) : Promise.resolve([])), [gymId]);
  const sessions = useLiveQuery(() => getAllSessions(), []);
  const climbs = useLiveQuery(() => getAllClimbs(), []);
  const [newGymName, setNewGymName] = useState("");
  const selectedGym = useMemo(() => gyms?.find((gym) => gym.id === gymId) ?? null, [gyms, gymId]);

  if (!gyms || !grades || !sessions || !climbs) {
    return <main className="app-shell loading">Loading gyms...</main>;
  }

  async function handleCreateGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const gym = await createGym(newGymName);
      setNewGymName("");
      navigate(`/gyms/${gym.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not create gym.");
    }
  }

  return (
    <main className="app-shell">
      <header className="session-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Gyms</h1>
        </div>
        <Link to="/" className="ghost-link">
          Home
        </Link>
      </header>

      <section className="section">
        <div className="gym-list">
          {gyms.length === 0 ? (
            <p className="empty">Add your first gym or board.</p>
          ) : (
            gyms.map((gym) => (
              <button
                key={gym.id}
                className={`gym-row ${gym.id === gymId ? "selected" : ""}`}
                onClick={() => navigate(`/gyms/${gym.id}`)}
              >
                <span>{gym.name}</span>
                {gym.isArchived && <small>Archived</small>}
              </button>
            ))
          )}
        </div>
        <form className="inline-form" onSubmit={handleCreateGym}>
          <input value={newGymName} onChange={(event) => setNewGymName(event.target.value)} placeholder="Kilter Board" />
          <button type="submit">+ Add Gym</button>
        </form>
      </section>

      {selectedGym && (
        <GymEditor
          key={selectedGym.id}
          gym={selectedGym}
          grades={grades}
          sessionUseCount={sessions.filter((session) => session.initialGymId === selectedGym.id).length}
          climbUseCount={climbs.filter((climb) => climb.gymId === selectedGym.id).length}
          onDeleted={() => navigate("/gyms")}
        />
      )}
    </main>
  );
}

type GymEditorProps = {
  gym: Gym;
  grades: Grade[];
  sessionUseCount: number;
  climbUseCount: number;
  onDeleted: () => void;
};

function GymEditor({ gym, grades, sessionUseCount, climbUseCount, onDeleted }: GymEditorProps) {
  const [name, setName] = useState(gym.name);
  const [newGradeLabel, setNewGradeLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(gym.name);
    setMessage(null);
  }, [gym.id, gym.name]);

  async function handleSaveGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await updateGym(gym.id, name);
      setMessage("Gym saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save gym.");
    }
  }

  async function handleAddGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createGrade(gym.id, newGradeLabel);
      setNewGradeLabel("");
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add grade.");
    }
  }

  async function handleArchiveGym() {
    await archiveGym(gym.id, !gym.isArchived);
  }

  async function handleDeleteGym() {
    if (!window.confirm(`Delete ${gym.name}? This is only allowed when it has no session or climb references.`)) {
      return;
    }
    try {
      await deleteGym(gym.id);
      onDeleted();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not delete gym.");
    }
  }

  return (
    <section className="section gym-editor">
      <form className="climb-form compact-form" onSubmit={handleSaveGym}>
        <label>
          Gym name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="submit">Save Gym</button>
      </form>

      <div className="section-heading grade-heading">
        <h2>Grades</h2>
      </div>
      <div className="grade-list">
        {grades.length === 0 ? (
          <p className="empty">Grades will appear here.</p>
        ) : (
          grades.map((grade, index) => (
            <GradeRow
              key={grade.id}
              grade={grade}
              isFirst={index === 0}
              isLast={index === grades.length - 1}
              onMessage={setMessage}
            />
          ))
        )}
      </div>
      <form className="inline-form" onSubmit={handleAddGrade}>
        <input
          value={newGradeLabel}
          onChange={(event) => setNewGradeLabel(event.target.value)}
          placeholder="V4 or 2Q"
        />
        <button type="submit">+ Add Grade</button>
      </form>

      {message && <p className={message.includes("Could") || message.includes("only") ? "error" : "restore-message"}>{message}</p>}

      <div className="gym-danger-zone">
        <button className="secondary full" onClick={handleArchiveGym}>
          {gym.isArchived ? "Restore Gym" : "Archive Gym"}
        </button>
        <button className="danger subtle-danger full" onClick={handleDeleteGym}>
          Delete Unused Gym
        </button>
        <p className="muted">
          References: {sessionUseCount} initial sessions, {climbUseCount} climbs
        </p>
      </div>
    </section>
  );
}

type GradeRowProps = {
  grade: Grade;
  isFirst: boolean;
  isLast: boolean;
  onMessage: (message: string | null) => void;
};

function GradeRow({ grade, isFirst, isLast, onMessage }: GradeRowProps) {
  const [label, setLabel] = useState(grade.label);

  useEffect(() => {
    setLabel(grade.label);
  }, [grade.label]);

  async function handleSave() {
    try {
      await updateGrade(grade.id, label);
      onMessage("Grade saved.");
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not save grade.");
    }
  }

  async function handleDelete() {
    try {
      await deleteGrade(grade.id);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not delete grade.");
    }
  }

  return (
    <div className={`grade-row ${grade.isArchived ? "archived" : ""}`}>
      <input value={label} onChange={(event) => setLabel(event.target.value)} aria-label="Grade label" />
      <div className="grade-actions">
        <button type="button" disabled={isFirst} onClick={() => moveGrade(grade.id, "up")} aria-label="Move grade up">
          ↑
        </button>
        <button type="button" disabled={isLast} onClick={() => moveGrade(grade.id, "down")} aria-label="Move grade down">
          ↓
        </button>
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={() => archiveGrade(grade.id, !grade.isArchived)}>
          {grade.isArchived ? "Restore" : "Archive"}
        </button>
        <button type="button" className="danger" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
