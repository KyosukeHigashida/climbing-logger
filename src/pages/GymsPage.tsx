import { useLiveQuery } from "dexie-react-hooks";
import { type FormEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useActiveSession } from "../context/ActiveSessionContext";
import {
  archiveBoard,
  archiveGrade,
  archiveGym,
  createBoard,
  createBoardGrade,
  createBoardWallAngle,
  createGrade,
  createGym,
  createWallAngle,
  deleteBoard,
  deleteGrade,
  deleteGym,
  deleteWallAngle,
  getAllBoards,
  getAllClimbs,
  getAllGyms,
  getAllSessions,
  getBoardGrades,
  getBoardWallAngles,
  getGymGrades,
  getGymWallAngles,
  reorderBoardGrades,
  reorderBoardWallAngles,
  reorderWallAngles,
  reorderGrades,
  replaceBoardGrades,
  replaceBoardWallAngles,
  replaceGymGrades,
  replaceGymWallAngles,
  updateBoard,
  updateGrade,
  updateGym,
  updateWallAngle,
} from "../db/repository";
import type { Board, Grade, Gym, WallAngle } from "../types/domain";
import { parseOptionalNumericInput } from "../utils/numericInput";
import { anglePresets, type AnglePresetId, gradePresets, type GradePresetId } from "../utils/presets";

export function GymsPage() {
  const { gymId, boardId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isBoardMode = location.pathname.startsWith("/boards");
  const { upsertBoard, removeBoard, upsertGrade, removeGrade, upsertWallAngle, removeWallAngle } = useActiveSession();
  const gyms = useLiveQuery(() => getAllGyms(), []);
  const boards = useLiveQuery<Board[]>(() => getAllBoards(), []);
  const grades = useLiveQuery<Grade[]>(
    () =>
      isBoardMode
        ? boardId
          ? getBoardGrades(boardId, true)
          : Promise.resolve([])
        : gymId
          ? getGymGrades(gymId, true)
          : Promise.resolve([]),
    [boardId, gymId, isBoardMode],
  );
  const wallAngles = useLiveQuery<WallAngle[]>(
    () =>
      isBoardMode
        ? boardId
          ? getBoardWallAngles(boardId)
          : Promise.resolve([])
        : gymId
          ? getGymWallAngles(gymId)
          : Promise.resolve([]),
    [boardId, gymId, isBoardMode],
  );
  const sessions = useLiveQuery(() => getAllSessions(), []);
  const climbs = useLiveQuery(() => getAllClimbs(), []);
  const [newGymName, setNewGymName] = useState("");
  const selectedGym = useMemo(() => gyms?.find((gym) => gym.id === gymId) ?? null, [gyms, gymId]);
  const selectedBoard = useMemo(() => boards?.find((board) => board.id === boardId) ?? null, [boards, boardId]);

  if (!gyms || !boards || !grades || !wallAngles || !sessions || !climbs) {
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

  async function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const board = await createBoard(newGymName);
      upsertBoard(board);
      setNewGymName("");
      navigate(`/boards/${board.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not create board.");
    }
  }

  return (
    <main className="app-shell">
      <header className="session-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>{isBoardMode ? "Boards" : "Gyms"}</h1>
        </div>
        <Link to="/" className="ghost-link">
          Home
        </Link>
      </header>

      <section className="section">
        <div className="gym-list">
          {(isBoardMode ? boards : gyms).length === 0 ? (
            <p className="empty">{isBoardMode ? "Add your first board." : "Add your first gym."}</p>
          ) : (
            isBoardMode ? boards.map((board) => (
              <button
                key={board.id}
                className={`gym-row ${board.id === boardId ? "selected" : ""}`}
                onClick={() => navigate(`/boards/${board.id}`)}
              >
                <span>{board.name}</span>
                {board.isArchived && <small>Archived</small>}
              </button>
            )) : gyms.map((gym) => (
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
        <form className="inline-form" onSubmit={isBoardMode ? handleCreateBoard : handleCreateGym}>
          <input
            value={newGymName}
            onChange={(event) => setNewGymName(event.target.value)}
            placeholder={isBoardMode ? "Board name" : "Gym name"}
          />
          <button type="submit">{isBoardMode ? "+ Add Board" : "+ Add Gym"}</button>
        </form>
      </section>

      {!isBoardMode && selectedGym && (
        <GymEditor
          key={selectedGym.id}
          gym={selectedGym}
          grades={grades}
          wallAngles={wallAngles}
          onGradeChanged={upsertGrade}
          onGradeRemoved={removeGrade}
          onWallAngleChanged={upsertWallAngle}
          onWallAngleRemoved={removeWallAngle}
          onDeleted={() => navigate("/gyms")}
        />
      )}

      {isBoardMode && selectedBoard && (
        <BoardEditor
          key={selectedBoard.id}
          board={selectedBoard}
          grades={grades}
          wallAngles={wallAngles}
          onGradeChanged={upsertGrade}
          onGradeRemoved={removeGrade}
          onWallAngleChanged={upsertWallAngle}
          onWallAngleRemoved={removeWallAngle}
          onBoardDeleted={removeBoard}
          onDeleted={() => navigate("/boards")}
        />
      )}
    </main>
  );
}

type GymEditorProps = {
  gym: Gym;
  grades: Grade[];
  wallAngles: WallAngle[];
  onGradeChanged: (grade: Grade) => void;
  onGradeRemoved: (gradeId: string) => void;
  onWallAngleChanged: (wallAngle: WallAngle) => void;
  onWallAngleRemoved: (wallAngleId: string) => void;
  onDeleted: () => void;
};

type BoardEditorProps = {
  board: Board;
  grades: Grade[];
  wallAngles: WallAngle[];
  onGradeChanged: (grade: Grade) => void;
  onGradeRemoved: (gradeId: string) => void;
  onWallAngleChanged: (wallAngle: WallAngle) => void;
  onWallAngleRemoved: (wallAngleId: string) => void;
  onBoardDeleted: (boardId: string) => void;
  onDeleted: () => void;
};

function BoardEditor({
  board,
  grades,
  wallAngles,
  onGradeChanged,
  onGradeRemoved,
  onWallAngleChanged,
  onWallAngleRemoved,
  onBoardDeleted,
  onDeleted,
}: BoardEditorProps) {
  const [name, setName] = useState(board.name);
  const [newGradeLabel, setNewGradeLabel] = useState("");
  const [newAngleValue, setNewAngleValue] = useState("");
  const [gradePresetId, setGradePresetId] = useState<GradePresetId>("v-grade");
  const [anglePresetId, setAnglePresetId] = useState<AnglePresetId>("board-5");
  const [gradeLabels, setGradeLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(grades.map((grade) => [grade.id, grade.label])),
  );
  const [angleValues, setAngleValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(wallAngles.map((angle) => [angle.id, angle.angle.toString()])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [orderedGradeIds, setOrderedGradeIds] = useState<string[]>(() => grades.map((grade) => grade.id));
  const [orderedAngleIds, setOrderedAngleIds] = useState<string[]>(() => wallAngles.map((angle) => angle.id));
  const [draggedGradeId, setDraggedGradeId] = useState<string | null>(null);
  const [draggedAngleId, setDraggedAngleId] = useState<string | null>(null);
  const [openGradeMenuId, setOpenGradeMenuId] = useState<string | null>(null);
  const [openAngleMenuId, setOpenAngleMenuId] = useState<string | null>(null);
  const orderedGradeIdsRef = useRef(orderedGradeIds);
  const orderedAngleIdsRef = useRef(orderedAngleIds);
  const orderedGrades = orderedGradeIds
    .map((gradeId) => grades.find((grade) => grade.id === gradeId))
    .filter((grade): grade is Grade => Boolean(grade));
  const orderedWallAngles = orderedAngleIds
    .map((angleId) => wallAngles.find((angle) => angle.id === angleId))
    .filter((angle): angle is WallAngle => Boolean(angle));

  useEffect(() => {
    setName(board.name);
    setMessage(null);
  }, [board.id, board.name]);

  useEffect(() => {
    if (draggedGradeId) {
      return;
    }
    setOpenGradeMenuId(null);
    setGradeLabels(Object.fromEntries(grades.map((grade) => [grade.id, grade.label])));
    const nextOrder = grades.map((grade) => grade.id);
    orderedGradeIdsRef.current = nextOrder;
    setOrderedGradeIds(nextOrder);
  }, [draggedGradeId, grades]);

  useEffect(() => {
    if (draggedAngleId) {
      return;
    }
    setOpenAngleMenuId(null);
    setAngleValues(Object.fromEntries(wallAngles.map((angle) => [angle.id, angle.angle.toString()])));
    const nextOrder = wallAngles.map((angle) => angle.id);
    orderedAngleIdsRef.current = nextOrder;
    setOrderedAngleIds(nextOrder);
  }, [draggedAngleId, wallAngles]);

  async function handleSaveChanges() {
    try {
      await updateBoard(board.id, name);
      const updatedGrades = await Promise.all(
        grades
          .filter((grade) => (gradeLabels[grade.id] ?? grade.label).trim() !== grade.label)
          .map((grade) => updateGrade(grade.id, gradeLabels[grade.id] ?? grade.label)),
      );
      updatedGrades.forEach(onGradeChanged);
      const updatedWallAngles = await Promise.all(
        wallAngles
          .filter((angle) => (angleValues[angle.id] ?? angle.angle.toString()).trim() !== angle.angle.toString())
          .map((angle) => {
            const parsedAngle = parseWallAngleInput(angleValues[angle.id] ?? angle.angle.toString());
            return updateWallAngle(angle.id, parsedAngle);
          }),
      );
      updatedWallAngles.forEach(onWallAngleChanged);
      setMessage("Changes saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save changes.");
    }
  }

  async function handleAddGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const grade = await createBoardGrade(board.id, newGradeLabel);
      onGradeChanged(grade);
      setNewGradeLabel("");
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add grade.");
    }
  }

  async function handleLoadGradePreset() {
    const preset = gradePresets[gradePresetId];
    if (grades.length > 0 && !window.confirm("This will replace the current grade list with the selected preset.")) {
      return;
    }
    try {
      await replaceBoardGrades(board.id, preset.labels);
      const nextGrades = await getBoardGrades(board.id, true);
      const nextGradeIds = new Set(nextGrades.map((grade) => grade.id));
      nextGrades.forEach(onGradeChanged);
      grades.forEach((grade) => {
        if (!nextGradeIds.has(grade.id)) {
          onGradeRemoved(grade.id);
        }
      });
      setMessage("Grade preset loaded.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load grade preset.");
    }
  }

  async function handleAddAngle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const parsedAngle = parseWallAngleInput(newAngleValue);
      const wallAngle = await createBoardWallAngle(board.id, parsedAngle);
      onWallAngleChanged(wallAngle);
      setNewAngleValue("");
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add angle.");
    }
  }

  async function handleLoadAnglePreset() {
    const preset = anglePresets[anglePresetId];
    if (wallAngles.length > 0 && !window.confirm("This will replace the current wall angle list with the selected preset.")) {
      return;
    }
    try {
      await replaceBoardWallAngles(board.id, preset.angles);
      const nextWallAngles = await getBoardWallAngles(board.id, true);
      const nextWallAngleIds = new Set(nextWallAngles.map((angle) => angle.id));
      nextWallAngles.forEach(onWallAngleChanged);
      wallAngles.forEach((angle) => {
        if (!nextWallAngleIds.has(angle.id)) {
          onWallAngleRemoved(angle.id);
        }
      });
      setMessage("Angle preset loaded.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load angle preset.");
    }
  }

  function moveDraggedId(current: string[], draggedId: string, targetId: string): string[] {
    const from = current.indexOf(draggedId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) {
      return current;
    }
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
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
      const next = moveDraggedId(current, draggedGradeId, targetGradeId);
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
      await reorderBoardGrades(board.id, orderedGradeIdsRef.current);
      setMessage(null);
    } catch (err) {
      const nextOrder = grades.map((grade) => grade.id);
      orderedGradeIdsRef.current = nextOrder;
      setOrderedGradeIds(nextOrder);
      setMessage(err instanceof Error ? err.message : "Could not reorder grades.");
    }
  }

  function handleAnglePointerDown(event: PointerEvent<HTMLButtonElement>, angleId: string) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setOpenAngleMenuId(null);
    setDraggedAngleId(angleId);
  }

  function handleAnglePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggedAngleId) {
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-angle-id]");
    const targetAngleId = target?.dataset.angleId;
    if (!targetAngleId || targetAngleId === draggedAngleId) {
      return;
    }

    setOrderedAngleIds((current) => {
      const next = moveDraggedId(current, draggedAngleId, targetAngleId);
      orderedAngleIdsRef.current = next;
      return next;
    });
  }

  async function handleAnglePointerUp() {
    if (!draggedAngleId) {
      return;
    }
    setDraggedAngleId(null);
    try {
      await reorderBoardWallAngles(board.id, orderedAngleIdsRef.current);
      setMessage(null);
    } catch (err) {
      const nextOrder = wallAngles.map((angle) => angle.id);
      orderedAngleIdsRef.current = nextOrder;
      setOrderedAngleIds(nextOrder);
      setMessage(err instanceof Error ? err.message : "Could not reorder angles.");
    }
  }

  async function handleDeleteBoard() {
    if (!window.confirm(`Delete ${board.name}? This is only allowed when it has no climb references.`)) {
      return;
    }
    try {
      await deleteBoard(board.id);
      onBoardDeleted(board.id);
      onDeleted();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not delete board.");
    }
  }

  return (
    <section className="section gym-editor">
      <div className="master-name-field">
        <label>
          Board name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      </div>

      <div className="section-heading grade-heading">
        <h2>Grades</h2>
      </div>
      <div className="preset-loader">
        <select value={gradePresetId} onChange={(event) => setGradePresetId(event.target.value as GradePresetId)}>
          {(Object.keys(gradePresets) as GradePresetId[]).map((presetId) => (
            <option key={presetId} value={presetId}>
              {gradePresets[presetId].name}
            </option>
          ))}
        </select>
        <button className="secondary" onClick={handleLoadGradePreset}>
          Load Preset
        </button>
      </div>
      <div className="grade-table" role="list" aria-label="Board grades">
        {grades.length === 0 ? (
          <p className="empty">Grades will appear here.</p>
        ) : (
          orderedGrades.map((grade) => (
            <GradeRow
              key={grade.id}
              grade={grade}
              label={gradeLabels[grade.id] ?? grade.label}
              isDragging={grade.id === draggedGradeId}
              isMenuOpen={grade.id === openGradeMenuId}
              onLabelChange={(label) => setGradeLabels((current) => ({ ...current, [grade.id]: label }))}
              onDragStart={handleGradePointerDown}
              onDragMove={handleGradePointerMove}
              onDragEnd={handleGradePointerUp}
              onToggleMenu={() => setOpenGradeMenuId((current) => (current === grade.id ? null : grade.id))}
              onCloseMenu={() => setOpenGradeMenuId(null)}
              onGradeChanged={onGradeChanged}
              onGradeRemoved={onGradeRemoved}
              onMessage={setMessage}
            />
          ))
        )}
      </div>
      <form className="inline-form" onSubmit={handleAddGrade}>
        <input value={newGradeLabel} onChange={(event) => setNewGradeLabel(event.target.value)} placeholder="Grade label" />
        <button type="submit">+ Add Grade</button>
      </form>

      <div className="section-heading grade-heading">
        <h2>Wall Angles</h2>
      </div>
      <div className="preset-loader">
        <select value={anglePresetId} onChange={(event) => setAnglePresetId(event.target.value as AnglePresetId)}>
          {(Object.keys(anglePresets) as AnglePresetId[]).map((presetId) => (
            <option key={presetId} value={presetId}>
              {anglePresets[presetId].name}
            </option>
          ))}
        </select>
        <button className="secondary" onClick={handleLoadAnglePreset}>
          Load Preset
        </button>
      </div>
      <div className="grade-table" role="list" aria-label="Board wall angles">
        {wallAngles.length === 0 ? (
          <p className="empty">Wall angles will appear here.</p>
        ) : (
          orderedWallAngles.map((angle) => (
            <AngleRow
              key={angle.id}
              angle={angle}
              value={angleValues[angle.id] ?? angle.angle.toString()}
              isDragging={angle.id === draggedAngleId}
              isMenuOpen={angle.id === openAngleMenuId}
              onValueChange={(value) => setAngleValues((current) => ({ ...current, [angle.id]: value }))}
              onDragStart={handleAnglePointerDown}
              onDragMove={handleAnglePointerMove}
              onDragEnd={handleAnglePointerUp}
              onToggleMenu={() => setOpenAngleMenuId((current) => (current === angle.id ? null : angle.id))}
              onCloseMenu={() => setOpenAngleMenuId(null)}
              onWallAngleChanged={onWallAngleChanged}
              onWallAngleRemoved={onWallAngleRemoved}
              onMessage={setMessage}
            />
          ))
        )}
      </div>
      <form className="inline-form" onSubmit={handleAddAngle}>
        <input inputMode="decimal" value={newAngleValue} onChange={(event) => setNewAngleValue(event.target.value)} placeholder="Wall angle" />
        <button type="submit">+ Add Angle</button>
      </form>

      {message && <p className={message.includes("Could") || message.includes("only") ? "error" : "restore-message"}>{message}</p>}

      <div className="gym-danger-zone">
        <button className="primary full" onClick={handleSaveChanges}>
          Save Changes
        </button>
        <button className="secondary full" onClick={() => archiveBoard(board.id, !board.isArchived)}>
          {board.isArchived ? "Restore Board" : "Archive Board"}
        </button>
        <button className="danger subtle-danger full" onClick={handleDeleteBoard}>
          Delete Unused Board
        </button>
      </div>
    </section>
  );
}

function GymEditor({
  gym,
  grades,
  wallAngles,
  onGradeChanged,
  onGradeRemoved,
  onWallAngleChanged,
  onWallAngleRemoved,
  onDeleted,
}: GymEditorProps) {
  const [name, setName] = useState(gym.name);
  const [newGradeLabel, setNewGradeLabel] = useState("");
  const [newAngleValue, setNewAngleValue] = useState("");
  const [gradePresetId, setGradePresetId] = useState<GradePresetId>("q-d");
  const [anglePresetId, setAnglePresetId] = useState<AnglePresetId>("fixed-10");
  const [gradeLabels, setGradeLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(grades.map((grade) => [grade.id, grade.label])),
  );
  const [angleValues, setAngleValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(wallAngles.map((angle) => [angle.id, angle.angle.toString()])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [orderedGradeIds, setOrderedGradeIds] = useState<string[]>(() => grades.map((grade) => grade.id));
  const [draggedGradeId, setDraggedGradeId] = useState<string | null>(null);
  const [draggedAngleId, setDraggedAngleId] = useState<string | null>(null);
  const [openGradeMenuId, setOpenGradeMenuId] = useState<string | null>(null);
  const [openAngleMenuId, setOpenAngleMenuId] = useState<string | null>(null);
  const orderedGradeIdsRef = useRef(orderedGradeIds);
  const [orderedAngleIds, setOrderedAngleIds] = useState<string[]>(() => wallAngles.map((angle) => angle.id));
  const orderedAngleIdsRef = useRef(orderedAngleIds);
  const orderedGrades = orderedGradeIds
    .map((gradeId) => grades.find((grade) => grade.id === gradeId))
    .filter((grade): grade is Grade => Boolean(grade));
  const orderedWallAngles = orderedAngleIds
    .map((angleId) => wallAngles.find((angle) => angle.id === angleId))
    .filter((angle): angle is WallAngle => Boolean(angle));

  useEffect(() => {
    setName(gym.name);
    setMessage(null);
  }, [gym.id, gym.name]);

  useEffect(() => {
    if (draggedGradeId) {
      return;
    }
    setOpenGradeMenuId(null);
    setGradeLabels(Object.fromEntries(grades.map((grade) => [grade.id, grade.label])));
    const nextOrder = grades.map((grade) => grade.id);
    orderedGradeIdsRef.current = nextOrder;
    setOrderedGradeIds(nextOrder);
  }, [draggedGradeId, grades]);

  useEffect(() => {
    if (draggedAngleId) {
      return;
    }
    setOpenAngleMenuId(null);
    setAngleValues(Object.fromEntries(wallAngles.map((angle) => [angle.id, angle.angle.toString()])));
    const nextOrder = wallAngles.map((angle) => angle.id);
    orderedAngleIdsRef.current = nextOrder;
    setOrderedAngleIds(nextOrder);
  }, [draggedAngleId, wallAngles]);

  async function handleSaveChanges() {
    try {
      await updateGym(gym.id, name);
      const updatedGrades = await Promise.all(
        grades
          .filter((grade) => (gradeLabels[grade.id] ?? grade.label).trim() !== grade.label)
          .map((grade) => updateGrade(grade.id, gradeLabels[grade.id] ?? grade.label)),
      );
      updatedGrades.forEach(onGradeChanged);
      const updatedWallAngles = await Promise.all(
        wallAngles
          .filter((angle) => (angleValues[angle.id] ?? angle.angle.toString()).trim() !== angle.angle.toString())
          .map((angle) => {
            const parsedAngle = parseWallAngleInput(angleValues[angle.id] ?? angle.angle.toString());
            return updateWallAngle(angle.id, parsedAngle);
          }),
      );
      updatedWallAngles.forEach(onWallAngleChanged);
      setMessage("Changes saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save changes.");
    }
  }

  async function handleAddGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const grade = await createGrade(gym.id, newGradeLabel);
      onGradeChanged(grade);
      setNewGradeLabel("");
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add grade.");
    }
  }

  async function handleLoadGradePreset() {
    const preset = gradePresets[gradePresetId];
    if (
      grades.length > 0 &&
      !window.confirm("This will replace the current grade list with the selected preset.")
    ) {
      return;
    }
    try {
      await replaceGymGrades(gym.id, preset.labels);
      const nextGrades = await getGymGrades(gym.id, true);
      const nextGradeIds = new Set(nextGrades.map((grade) => grade.id));
      nextGrades.forEach(onGradeChanged);
      grades.forEach((grade) => {
        if (!nextGradeIds.has(grade.id)) {
          onGradeRemoved(grade.id);
        }
      });
      setMessage("Grade preset loaded.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load grade preset.");
    }
  }

  async function handleAddAngle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const parsedAngle = parseWallAngleInput(newAngleValue);
      const wallAngle = await createWallAngle(gym.id, parsedAngle);
      onWallAngleChanged(wallAngle);
      setNewAngleValue("");
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add angle.");
    }
  }

  async function handleLoadAnglePreset() {
    const preset = anglePresets[anglePresetId];
    if (
      wallAngles.length > 0 &&
      !window.confirm("This will replace the current wall angle list with the selected preset.")
    ) {
      return;
    }
    try {
      await replaceGymWallAngles(gym.id, preset.angles);
      const nextWallAngles = await getGymWallAngles(gym.id, true);
      const nextWallAngleIds = new Set(nextWallAngles.map((angle) => angle.id));
      nextWallAngles.forEach(onWallAngleChanged);
      wallAngles.forEach((angle) => {
        if (!nextWallAngleIds.has(angle.id)) {
          onWallAngleRemoved(angle.id);
        }
      });
      setMessage("Angle preset loaded.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load angle preset.");
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

  function moveDraggedId(current: string[], draggedId: string, targetId: string): string[] {
    const from = current.indexOf(draggedId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) {
      return current;
    }
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
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
      const next = moveDraggedId(current, draggedGradeId, targetGradeId);
      orderedGradeIdsRef.current = next;
      return next;
    });
  }

  function handleAnglePointerDown(event: PointerEvent<HTMLButtonElement>, angleId: string) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setOpenAngleMenuId(null);
    setDraggedAngleId(angleId);
  }

  function handleAnglePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggedAngleId) {
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-angle-id]");
    const targetAngleId = target?.dataset.angleId;
    if (!targetAngleId || targetAngleId === draggedAngleId) {
      return;
    }

    setOrderedAngleIds((current) => {
      const next = moveDraggedId(current, draggedAngleId, targetAngleId);
      orderedAngleIdsRef.current = next;
      return next;
    });
  }

  async function handleAnglePointerUp() {
    if (!draggedAngleId) {
      return;
    }
    setDraggedAngleId(null);
    try {
      await reorderWallAngles(gym.id, orderedAngleIdsRef.current);
      setMessage(null);
    } catch (err) {
      const nextOrder = wallAngles.map((angle) => angle.id);
      orderedAngleIdsRef.current = nextOrder;
      setOrderedAngleIds(nextOrder);
      setMessage(err instanceof Error ? err.message : "Could not reorder angles.");
    }
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
      <div className="master-name-field">
        <label>
          Gym name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      </div>

      <div className="section-heading grade-heading">
        <h2>Grades</h2>
      </div>
      <div className="preset-loader">
        <select value={gradePresetId} onChange={(event) => setGradePresetId(event.target.value as GradePresetId)}>
          {(Object.keys(gradePresets) as GradePresetId[]).map((presetId) => (
            <option key={presetId} value={presetId}>
              {gradePresets[presetId].name}
            </option>
          ))}
        </select>
        <button className="secondary" onClick={handleLoadGradePreset}>
          Load Preset
        </button>
      </div>
      <div className="grade-table" role="list" aria-label="Grades">
        {grades.length === 0 ? (
          <p className="empty">Grades will appear here.</p>
        ) : (
          orderedGrades.map((grade) => (
            <GradeRow
              key={grade.id}
              grade={grade}
              label={gradeLabels[grade.id] ?? grade.label}
              isDragging={grade.id === draggedGradeId}
              isMenuOpen={grade.id === openGradeMenuId}
              onLabelChange={(label) => setGradeLabels((current) => ({ ...current, [grade.id]: label }))}
              onDragStart={handleGradePointerDown}
              onDragMove={handleGradePointerMove}
              onDragEnd={handleGradePointerUp}
              onToggleMenu={() => setOpenGradeMenuId((current) => (current === grade.id ? null : grade.id))}
              onCloseMenu={() => setOpenGradeMenuId(null)}
              onGradeChanged={onGradeChanged}
              onGradeRemoved={onGradeRemoved}
              onMessage={setMessage}
            />
          ))
        )}
      </div>
      <form className="inline-form" onSubmit={handleAddGrade}>
        <input
          value={newGradeLabel}
          onChange={(event) => setNewGradeLabel(event.target.value)}
          placeholder="Grade label"
        />
        <button type="submit">+ Add Grade</button>
      </form>

      <div className="section-heading grade-heading">
        <h2>Wall Angles</h2>
      </div>
      <div className="preset-loader">
        <select value={anglePresetId} onChange={(event) => setAnglePresetId(event.target.value as AnglePresetId)}>
          {(Object.keys(anglePresets) as AnglePresetId[]).map((presetId) => (
            <option key={presetId} value={presetId}>
              {anglePresets[presetId].name}
            </option>
          ))}
        </select>
        <button className="secondary" onClick={handleLoadAnglePreset}>
          Load Preset
        </button>
      </div>
      <div className="grade-table" role="list" aria-label="Wall angles">
        {wallAngles.length === 0 ? (
          <p className="empty">Wall angles will appear here.</p>
        ) : (
          orderedWallAngles.map((angle) => (
            <AngleRow
              key={angle.id}
              angle={angle}
              value={angleValues[angle.id] ?? angle.angle.toString()}
              isDragging={angle.id === draggedAngleId}
              isMenuOpen={angle.id === openAngleMenuId}
              onValueChange={(value) => setAngleValues((current) => ({ ...current, [angle.id]: value }))}
              onDragStart={handleAnglePointerDown}
              onDragMove={handleAnglePointerMove}
              onDragEnd={handleAnglePointerUp}
              onToggleMenu={() => setOpenAngleMenuId((current) => (current === angle.id ? null : angle.id))}
              onCloseMenu={() => setOpenAngleMenuId(null)}
              onWallAngleChanged={onWallAngleChanged}
              onWallAngleRemoved={onWallAngleRemoved}
              onMessage={setMessage}
            />
          ))
        )}
      </div>
      <form className="inline-form" onSubmit={handleAddAngle}>
        <input
          inputMode="decimal"
          value={newAngleValue}
          onChange={(event) => setNewAngleValue(event.target.value)}
          placeholder="Wall angle"
        />
        <button type="submit">+ Add Angle</button>
      </form>

      {message && <p className={message.includes("Could") || message.includes("only") ? "error" : "restore-message"}>{message}</p>}

      <div className="gym-danger-zone">
        <button className="primary full" onClick={handleSaveChanges}>
          Save Changes
        </button>
        <button className="secondary full" onClick={handleArchiveGym}>
          {gym.isArchived ? "Restore Gym" : "Archive Gym"}
        </button>
        <button className="danger subtle-danger full" onClick={handleDeleteGym}>
          Delete Unused Gym
        </button>
      </div>
    </section>
  );
}

type GradeRowProps = {
  grade: Grade;
  label: string;
  isDragging: boolean;
  isMenuOpen: boolean;
  onLabelChange: (label: string) => void;
  onDragStart: (event: PointerEvent<HTMLButtonElement>, gradeId: string) => void;
  onDragMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onGradeChanged: (grade: Grade) => void;
  onGradeRemoved: (gradeId: string) => void;
  onMessage: (message: string | null) => void;
};

function GradeRow({
  grade,
  label,
  isDragging,
  isMenuOpen,
  onLabelChange,
  onDragStart,
  onDragMove,
  onDragEnd,
  onToggleMenu,
  onCloseMenu,
  onGradeChanged,
  onGradeRemoved,
  onMessage,
}: GradeRowProps) {
  async function handleArchive() {
    try {
      const updatedGrade = await archiveGrade(grade.id, !grade.isArchived);
      onGradeChanged(updatedGrade);
      onCloseMenu();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not update grade.");
    }
  }

  async function handleDelete() {
    try {
      await deleteGrade(grade.id);
      onGradeRemoved(grade.id);
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
      <input value={label} onChange={(event) => onLabelChange(event.target.value)} aria-label="Grade label" />
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

type AngleRowProps = {
  angle: WallAngle;
  value: string;
  isDragging: boolean;
  isMenuOpen: boolean;
  onValueChange: (value: string) => void;
  onDragStart: (event: PointerEvent<HTMLButtonElement>, angleId: string) => void;
  onDragMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onWallAngleChanged: (wallAngle: WallAngle) => void;
  onWallAngleRemoved: (wallAngleId: string) => void;
  onMessage: (message: string | null) => void;
};

function AngleRow({
  angle,
  value,
  isDragging,
  isMenuOpen,
  onValueChange,
  onDragStart,
  onDragMove,
  onDragEnd,
  onToggleMenu,
  onCloseMenu,
  onWallAngleChanged,
  onWallAngleRemoved,
  onMessage,
}: AngleRowProps) {
  async function handleDelete() {
    try {
      const deletedResult = await deleteWallAngle(angle.id);
      if (deletedResult) {
        onWallAngleChanged(deletedResult);
      } else {
        onWallAngleRemoved(angle.id);
      }
      onCloseMenu();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Could not delete angle.");
    }
  }

  return (
    <div className={`grade-row ${isDragging ? "dragging" : ""}`} data-angle-id={angle.id} role="listitem">
      <button
        type="button"
        className="drag-handle"
        aria-label={`Drag ${angle.angle} degrees`}
        onPointerDown={(event) => onDragStart(event, angle.id)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        ⋮⋮
      </button>
      <div className="angle-input-row compact-angle-input">
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-label="Wall angle"
        />
        <span>°</span>
      </div>
      <button
        type="button"
        className="grade-menu-button"
        aria-expanded={isMenuOpen}
        aria-label={`Open actions for ${angle.angle} degrees`}
        onClick={onToggleMenu}
      >
        ...
      </button>
      {isMenuOpen && (
        <div className="grade-actions single-action">
          <button type="button" className="danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function parseWallAngleInput(value: string): number {
  return parseOptionalNumericInput(value, { label: "Wall angle", required: true, min: 0, max: 180 }) ?? 0;
}
