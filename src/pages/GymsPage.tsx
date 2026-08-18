import { useLiveQuery } from "dexie-react-hooks";
import { type FormEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
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
  reorderGrades,
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
  const [orderedGradeIds, setOrderedGradeIds] = useState<string[]>(() => grades.map((grade) => grade.id));
  const [draggedGradeId, setDraggedGradeId] = useState<string | null>(null);
  const [openGradeMenuId, setOpenGradeMenuId] = useState<string | null>(null);
  const orderedGradeIdsRef = useRef(orderedGradeIds);
  const orderedGrades = orderedGradeIds
    .map((gradeId) => grades.find((grade) => grade.id === gradeId))
    .filter((grade): grade is Grade => Boolean(grade));

  useEffect(() => {
    setName(gym.name);
    setMessage(null);
  }, [gym.id, gym.name]);

  useEffect(() => {
    if (draggedGradeId) {
      return;
    }
    setOpenGradeMenuId(null);
    const nextOrder = grades.map((grade) => grade.id);
    orderedGradeIdsRef.current = nextOrder;
    setOrderedGradeIds(nextOrder);
  }, [draggedGradeId, grades]);

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

  function handleGradePointerDown(event: PointerEvent<HTMLButtonElement>, gradeId: string) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setOpenGradeMenuId(null);
    setDraggedGradeId(gradeId);
  }

  function handleGradePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggedGradeId) {
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-grade-id]");
    const targetGradeId = target?.dataset.gradeId;
    if (!targetGradeId || targetGradeId === draggedGradeId) {
      return;
    }

    setOrderedGradeIds((current) => {
      const from = current.indexOf(draggedGradeId);
      const to = current.indexOf(targetGradeId);
      if (from < 0 || to < 0 || from === to) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      orderedGradeIdsRef.current = next;
      return next;
    });
  }

  async function handleGradePointerUp() {
    if (!draggedGradeId) {
      return;
    }
    setDraggedGradeId(null);
    try {
      await reorderGrades(gym.id, orderedGradeIdsRef.current);
      setMessage(null);
    } catch (err) {
      const nextOrder = grades.map((grade) => grade.id);
      orderedGradeIdsRef.current = nextOrder;
      setOrderedGradeIds(nextOrder);
      setMessage(err instanceof Error ? err.message : "Could not reorder grades.");
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
      <div className="grade-table" role="list" aria-label="Grades">
        {grades.length === 0 ? (
          <p className="empty">Grades will appear here.</p>
        ) : (
          orderedGrades.map((grade) => (
            <GradeRow
              key={grade.id}
              grade={grade}
              isDragging={grade.id === draggedGradeId}
              isMenuOpen={grade.id === openGradeMenuId}
              onDragStart={handleGradePointerDown}
              onDragMove={handleGradePointerMove}
              onDragEnd={handleGradePointerUp}
              onToggleMenu={() => setOpenGradeMenuId((current) => (current === grade.id ? null : grade.id))}
              onCloseMenu={() => setOpenGradeMenuId(null)}
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
  isDragging: boolean;
  isMenuOpen: boolean;
  onDragStart: (event: PointerEvent<HTMLButtonElement>, gradeId: string) => void;
  onDragMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onMessage: (message: string | null) => void;
};

function GradeRow({
  grade,
  isDragging,
  isMenuOpen,
  onDragStart,
  onDragMove,
  onDragEnd,
  onToggleMenu,
  onCloseMenu,
  onMessage,
}: GradeRowProps) {
  const [label, setLabel] = useState(grade.label);

  useEffect(() => {
    setLabel(grade.label);
  }, [grade.label]);

  async function handleSave() {
    try {
      await updateGrade(grade.id, label);
      onMessage("Grade saved.");
      onCloseMenu();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not save grade.");
    }
  }

  async function handleArchive() {
    try {
      await archiveGrade(grade.id, !grade.isArchived);
      onCloseMenu();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not update grade.");
    }
  }

  async function handleDelete() {
    try {
      await deleteGrade(grade.id);
      onCloseMenu();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not delete grade.");
    }
  }

  return (
    <div
      className={`grade-row ${grade.isArchived ? "archived" : ""} ${isDragging ? "dragging" : ""}`}
      data-grade-id={grade.id}
      role="listitem"
    >
      <button
        type="button"
        className="drag-handle"
        aria-label={`Drag ${grade.label}`}
        onPointerDown={(event) => onDragStart(event, grade.id)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        ⋮⋮
      </button>
      <input value={label} onChange={(event) => setLabel(event.target.value)} aria-label="Grade label" />
      <button
        type="button"
        className="grade-menu-button"
        aria-expanded={isMenuOpen}
        aria-label={`Open actions for ${grade.label}`}
        onClick={onToggleMenu}
      >
        ...
      </button>
      {grade.isArchived && <span className="grade-status">Archived</span>}
      {isMenuOpen && (
        <div className="grade-actions">
          <button type="button" onClick={handleSave}>
            Save
          </button>
          <button type="button" onClick={handleArchive}>
            {grade.isArchived ? "Restore" : "Archive"}
          </button>
          <button type="button" className="danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
