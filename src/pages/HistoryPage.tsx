import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAllAttempts,
  getAllGyms,
  getAllSessions,
  getAllStrengthSets,
} from "../db/repository";
import type { Attempt, Gym, Session, StrengthSet } from "../types/domain";
import {
  buildDayActivities,
  buildPeriodSummary,
  dateFromKey,
  formatMonthTitle,
  formatSelectedDateTitle,
  getCalendarDates,
  getMonthRange,
  getSessionsForDate,
  getTodayDate,
  getWeekRange,
  toDateKey,
  type PeriodSummary,
} from "../utils/history";
import { formatSessionDuration } from "../utils/time";

type SummaryMode = "week" | "month";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HistoryPage() {
  const navigate = useNavigate();
  const sessions = useLiveQuery(() => getAllSessions(), []);
  const attempts = useLiveQuery(() => getAllAttempts(), []);
  const strengthSets = useLiveQuery(() => getAllStrengthSets(), []);
  const gyms = useLiveQuery(() => getAllGyms(), []);
  const today = useMemo(() => getTodayDate(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(today));
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("month");
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  if (!sessions || !attempts || !strengthSets || !gyms) {
    return <main className="app-shell loading">Loading history...</main>;
  }

  const monthRange = getMonthRange(visibleMonth);
  const selectedDate = dateFromKey(selectedDateKey);
  const summaryRange = summaryMode === "week" ? getWeekRange(selectedDate) : monthRange;
  const calendarDates = getCalendarDates(visibleMonth);
  const calendarRange = { start: calendarDates[0], end: addDays(calendarDates[calendarDates.length - 1], 1) };
  const dayActivities = buildDayActivities(sessions, attempts, strengthSets, calendarRange);
  const summary = buildPeriodSummary(sessions, attempts, strengthSets, summaryRange);
  const selectedSessions = getSessionsForDate(sessions, selectedDateKey);
  const gymById = new Map(gyms.map((gym) => [gym.id, gym]));

  function handleMonthChange(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function handleToday() {
    const nextToday = getTodayDate();
    setVisibleMonth(new Date(nextToday.getFullYear(), nextToday.getMonth(), 1));
    setSelectedDateKey(toDateKey(nextToday));
  }

  function handleCalendarSwipeEnd(x: number, y: number) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) {
      return;
    }

    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return;
    }

    handleMonthChange(deltaX < 0 ? 1 : -1);
  }

  return (
    <main className="app-shell">
      <header className="session-header">
        <div>
          <p className="eyebrow">History</p>
          <h1>Activity Calendar</h1>
        </div>
        <Link className="ghost-link" to="/">
          Home
        </Link>
      </header>

      <section className="section history-section" aria-label="History calendar">
        <strong className="calendar-month-title">{formatMonthTitle(visibleMonth)}</strong>
        <div
          className="calendar-grid"
          role="grid"
          aria-label={formatMonthTitle(visibleMonth)}
          onPointerDown={(event) => {
            swipeStartRef.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerCancel={() => {
            swipeStartRef.current = null;
          }}
          onPointerUp={(event) => handleCalendarSwipeEnd(event.clientX, event.clientY)}
        >
          {weekdayLabels.map((label) => (
            <div className="calendar-weekday" key={label}>
              {label}
            </div>
          ))}
          {calendarDates.map((date) => {
            const dateKey = toDateKey(date);
            const activity = dayActivities.get(dateKey) ?? null;
            const isSelected = dateKey === selectedDateKey;
            const isOutsideMonth = date.getMonth() !== visibleMonth.getMonth();
            return (
              <button
                key={dateKey}
                type="button"
                className={`calendar-day ${isSelected ? "selected" : ""} ${isOutsideMonth ? "outside-month" : ""}`}
                aria-label={`${dateKey}${activity ? ", activity" : ""}`}
                onClick={() => {
                  setSelectedDateKey(dateKey);
                  if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
                    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                  }
                }}
              >
                <span>{date.getDate()}</span>
                <ActivityDots hasClimbing={Boolean(activity?.hasClimbing)} hasTraining={Boolean(activity?.hasTraining)} />
              </button>
            );
          })}
        </div>

        <div className="history-calendar-controls">
          <div className="calendar-toolbar">
            <button className="calendar-nav-button" aria-label="Previous month" onClick={() => handleMonthChange(-1)}>
              ‹
            </button>
            <span aria-hidden="true" />
            <button className="calendar-nav-button" aria-label="Next month" onClick={() => handleMonthChange(1)}>
              ›
            </button>
          </div>
          <button className="secondary full history-today-button" onClick={handleToday}>
            Today
          </button>
          <div className="history-mode-switch">
            <button className={summaryMode === "week" ? "selected" : ""} onClick={() => setSummaryMode("week")}>
              Week
            </button>
            <button className={summaryMode === "month" ? "selected" : ""} onClick={() => setSummaryMode("month")}>
              Month
            </button>
          </div>
        </div>
      </section>

      <section className="section history-summary-section" aria-label="Period summary">
        <div className="section-heading">
          <h2>{summaryMode === "week" ? "This week" : "This month"}</h2>
          <span className="muted">{formatRangeLabel(summaryRange)}</span>
        </div>
        <SummaryGrid summary={summary} />
      </section>

      <section className="section history-day-section" aria-label="Selected day sessions">
        <div className="section-heading">
          <h2>{formatSelectedDateTitle(selectedDateKey)}</h2>
          <span className="muted">{selectedSessions.length} sessions</span>
        </div>
        {selectedSessions.length === 0 ? (
          <p className="empty">No activity recorded for this day.</p>
        ) : (
          <div className="history-session-list">
            {selectedSessions.map((session) => (
              <HistorySessionCard
                key={session.id}
                session={session}
                gym={session.initialGymId ? gymById.get(session.initialGymId) ?? null : null}
                attempts={attempts.filter((attempt) => attempt.sessionId === session.id)}
                strengthSets={strengthSets.filter((set) => set.sessionId === session.id)}
                onOpen={() => navigate(`/session/${session.id}/summary`)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ActivityDots({ hasClimbing, hasTraining }: { hasClimbing: boolean; hasTraining: boolean }) {
  if (!hasClimbing && !hasTraining) {
    return <span className="activity-dots" aria-hidden="true" />;
  }
  return (
    <span className="activity-dots" aria-hidden="true">
      {hasClimbing && <span className="activity-dot climbing" />}
      {hasTraining && <span className="activity-dot training" />}
    </span>
  );
}

function SummaryGrid({ summary }: { summary: PeriodSummary }) {
  return (
    <div className="history-summary-grid">
      <SummaryMetric label="Sessions" value={summary.sessionCount} />
      <SummaryMetric label="Active days" value={summary.activeDays} />
      <SummaryMetric label="Attempts" value={summary.attemptCount} />
      <SummaryMetric label="Sends" value={summary.sendCount} />
      <SummaryMetric label="Sets" value={summary.strengthSetCount} />
      <SummaryMetric label="Total time" value={summary.totalDurationMs === null ? "—" : formatDuration(summary.totalDurationMs)} />
      <SummaryMetric label="Avg RPE" value={formatAverage(summary.averageSessionRpe)} />
      <SummaryMetric label="Performance" value={formatAverage(summary.averagePerformance)} />
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="history-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HistorySessionCard({
  session,
  gym,
  attempts,
  strengthSets,
  onOpen,
}: {
  session: Session;
  gym: Gym | null;
  attempts: Attempt[];
  strengthSets: StrengthSet[];
  onOpen: () => void;
}) {
  const sendCount = attempts.filter((attempt) => attempt.result === "send").length;
  return (
    <article className="history-session-card">
      <button className="history-session-open" onClick={onOpen}>
        <span>
          <strong>{gym?.name ?? "Unknown Gym"}</strong>
          <small>{formatSessionDuration(session.startedAt, session.endedAt)}</small>
          <small>
            {attempts.length} attempts · {sendCount} sends · {strengthSets.length} training sets
          </small>
        </span>
        <span className="muted">Open Summary</span>
      </button>
    </article>
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatAverage(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

function formatRangeLabel(range: { start: Date; end: Date }): string {
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${formatter.format(range.start)}-${formatter.format(addDays(range.end, -1))}`;
}
