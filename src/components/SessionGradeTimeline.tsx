import { useEffect, useMemo, useState } from "react";
import type { Attempt, Board, Climb, Grade, Session } from "../types/domain";
import { isCompletedAttempt, sortAttemptsByTimestamp } from "../utils/attempts";
import { effortLabels } from "../utils/effort";
import {
  buildSessionGradeTimeline,
  getGradeLevelRatio,
  type SessionGradeTimelineAttempt,
  type SessionGradeTimelineWall,
} from "../utils/sessionGradeTimeline";
import { formatIntervalDuration } from "../utils/time";

type SessionGradeTimelineProps = {
  session: Session;
  climbs: Climb[];
  attempts: Attempt[];
  grades: Grade[];
  boards: Board[];
};

const chartHeight = 230;
const margin = { top: 18, right: 18, bottom: 32, left: 42 };

export function SessionGradeTimeline({ session, climbs, attempts, grades, boards }: SessionGradeTimelineProps) {
  const boardOptions = useMemo(() => getTimelineBoardOptions(climbs, boards), [boards, climbs]);
  const initialWallValue = useMemo(() => getInitialGradeTimelineWallValue(session, climbs, attempts, grades), [attempts, climbs, grades, session]);
  const [selectedWallState, setSelectedWallState] = useState({ value: initialWallValue, userSelected: false });
  const selectedWallValue = selectedWallState.value;
  useEffect(() => {
    setSelectedWallState((current) => (current.userSelected || current.value === initialWallValue ? current : { ...current, value: initialWallValue }));
  }, [initialWallValue]);
  useEffect(() => {
    setSelectedWallState({ value: initialWallValue, userSelected: false });
  }, [session.id]);
  const selectedWall = useMemo((): SessionGradeTimelineWall => {
    if (selectedWallValue.startsWith("board:")) {
      return { type: "board", boardId: selectedWallValue.replace("board:", "") };
    }
    return { type: "gym" };
  }, [selectedWallValue]);
  const selectedWallLabel = selectedWall.type === "board"
    ? boardOptions.find((board) => board.id === selectedWall.boardId)?.name ?? "Board"
    : "Gym Wall";
  const timeline = useMemo(() => buildSessionGradeTimeline(session, climbs, attempts, grades, selectedWall), [attempts, climbs, grades, selectedWall, session]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(timeline.attempts[0]?.attemptId ?? null);
  const selectedAttempt = timeline.attempts.find((attempt) => attempt.attemptId === selectedAttemptId) ?? timeline.attempts[0] ?? null;
  const controls = (
    <label className="grade-timeline-wall-select">
      <span className="metric-label">Wall</span>
      <select value={selectedWallValue} onChange={(event) => setSelectedWallState({ value: event.target.value, userSelected: true })}>
        <option value="gym">Gym Wall</option>
        {boardOptions.length > 0 && <option disabled>────────</option>}
        {boardOptions.map((board) => (
          <option key={board.id} value={`board:${board.id}`}>
            {board.name}
          </option>
        ))}
      </select>
    </label>
  );

  if (timeline.attempts.length === 0 || timeline.grades.length === 0) {
    return (
      <section className="section grade-timeline-section" aria-label="Grade Timeline">
        <div className="section-heading">
          <h2>Grade Timeline</h2>
          {controls}
        </div>
        <p className="empty">{selectedWallLabel} attempts with recoverable grade order will appear here.</p>
      </section>
    );
  }

  const plotWidth = Math.max(260, Math.ceil(timeline.durationMs / 60_000) * 5);
  const width = margin.left + plotWidth + margin.right;
  const height = chartHeight;
  const plotHeight = height - margin.top - margin.bottom;
  const baseline = height - margin.bottom;
  const gradeCount = timeline.grades.length;
  const gradeY = (gradeId: string) => {
    const index = timeline.grades.findIndex((grade) => grade.id === gradeId);
    const gradeIndex = index >= 0 ? index : 0;
    return baseline - getGradeLevelRatio(gradeIndex, gradeCount) * plotHeight;
  };
  const attemptX = (attempt: SessionGradeTimelineAttempt) => margin.left + (attempt.elapsedMs / Math.max(timeline.durationMs, 1)) * plotWidth;
  const xLabels = getXAxisLabels(timeline.durationMs);

  return (
    <section className="section grade-timeline-section" aria-label="Grade Timeline">
      <div className="section-heading">
        <h2>Grade Timeline</h2>
        {controls}
      </div>
      <div className="grade-timeline-scroll">
        <svg className="grade-timeline-chart" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }} role="img" aria-label="Grade timeline chart">
          <line className="stats-axis" x1={margin.left} y1={margin.top} x2={margin.left} y2={baseline} />
          <line className="stats-axis" x1={margin.left} y1={baseline} x2={width - margin.right} y2={baseline} />
          <text className="stats-axis-label" x={margin.left - 6} y={margin.top - 6} textAnchor="end">
            Grade
          </text>
          {timeline.grades.map((grade) => {
            const y = gradeY(grade.id);
            return (
              <g key={grade.id}>
                <line className="grade-timeline-grid-line" x1={margin.left} y1={y} x2={width - margin.right} y2={y} />
                <text className="stats-axis-label" x={margin.left - 8} y={y + 3} textAnchor="end">
                  {grade.label}
                </text>
              </g>
            );
          })}
          {xLabels.map((minutes) => {
            const x = margin.left + ((minutes * 60_000) / Math.max(timeline.durationMs, 1)) * plotWidth;
            return (
              <g key={minutes}>
                <line className="grade-timeline-grid-line" x1={x} y1={margin.top} x2={x} y2={baseline} />
                <text className="stats-axis-label" x={x} y={height - 10} textAnchor="middle">
                  {minutes}m
                </text>
              </g>
            );
          })}
          {timeline.attempts.map((attempt) => {
            const x = attemptX(attempt);
            const y = gradeY(attempt.gradeId);
            const selected = selectedAttempt?.attemptId === attempt.attemptId;
            return (
              <g key={attempt.attemptId} className="grade-timeline-attempt" onClick={() => setSelectedAttemptId(attempt.attemptId)}>
                <title>{describeAttempt(attempt)}</title>
                <line
                  className={attempt.result === "send" ? "grade-timeline-bar send" : "grade-timeline-bar fail"}
                  x1={x}
                  y1={baseline}
                  x2={x}
                  y2={y}
                />
                <circle className={selected ? "grade-timeline-point selected" : "grade-timeline-point"} cx={x} cy={y} r={selected ? 5 : 3.5} />
                <rect className="stats-bucket-hit-area" x={x - 10} y={margin.top} width="20" height={plotHeight} />
              </g>
            );
          })}
        </svg>
      </div>
      {selectedAttempt && <GradeTimelineDetails attempt={selectedAttempt} />}
    </section>
  );
}

export function getInitialGradeTimelineWallValue(session: Session, climbs: Climb[], attempts: Attempt[], grades: Grade[]): string {
  const gymTimeline = buildSessionGradeTimeline(session, climbs, attempts, grades, { type: "gym" });
  if (gymTimeline.attempts.length > 0) {
    return "gym";
  }

  const climbById = new Map(climbs.map((climb) => [climb.id, climb]));
  const boardIdsByFirstAttempt = sortAttemptsByTimestamp(attempts)
    .filter(isCompletedAttempt)
    .flatMap((attempt) => {
      const climb = climbById.get(attempt.climbId);
      return climb?.wallType === "board" && climb.wallBoardId ? [climb.wallBoardId] : [];
    });

  for (const boardId of boardIdsByFirstAttempt) {
    const boardTimeline = buildSessionGradeTimeline(session, climbs, attempts, grades, { type: "board", boardId });
    if (boardTimeline.attempts.length > 0) {
      return `board:${boardId}`;
    }
  }

  return "gym";
}

function getTimelineBoardOptions(climbs: Climb[], boards: Board[]): Array<{ id: string; name: string }> {
  const boardById = new Map(boards.map((board) => [board.id, board]));
  return [...new Set(climbs.filter((climb) => climb.wallType === "board" && climb.wallBoardId).map((climb) => climb.wallBoardId as string))]
    .map((boardId) => ({ id: boardId, name: boardById.get(boardId)?.name ?? "Archived Board" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function GradeTimelineDetails({ attempt }: { attempt: SessionGradeTimelineAttempt }) {
  return (
    <div className="stats-bucket-details grade-timeline-details" aria-live="polite">
      <strong>{formatIntervalDuration(attempt.elapsedMs)}</strong>
      <span>{attempt.gradeLabel}</span>
      <span>{attempt.result.toUpperCase()}</span>
      {attempt.effort !== undefined && <span>Effort {effortLabels[attempt.effort]}</span>}
      {attempt.climbName && <span>{attempt.climbName}</span>}
      {attempt.wallAngle !== null && <span>{attempt.wallAngle}°</span>}
    </div>
  );
}

function getXAxisLabels(durationMs: number): number[] {
  const durationMinutes = Math.max(1, Math.ceil(durationMs / 60_000));
  const step = durationMinutes <= 60 ? 15 : durationMinutes <= 180 ? 30 : 60;
  const labels: number[] = [0];
  for (let minutes = step; minutes < durationMinutes; minutes += step) {
    labels.push(minutes);
  }
  if (!labels.includes(durationMinutes)) {
    labels.push(durationMinutes);
  }
  return labels;
}

function describeAttempt(attempt: SessionGradeTimelineAttempt): string {
  const parts = [`${formatIntervalDuration(attempt.elapsedMs)}`, attempt.gradeLabel, attempt.result.toUpperCase()];
  if (attempt.effort !== undefined) {
    parts.push(`Effort ${effortLabels[attempt.effort]}`);
  }
  if (attempt.climbName) {
    parts.push(attempt.climbName);
  }
  if (attempt.wallAngle !== null) {
    parts.push(`${attempt.wallAngle}°`);
  }
  return parts.join(", ");
}
