import type { Attempt, Climb } from "../types/domain";
import { getSessionAttemptIntervals, sortAttemptsByTimestampDesc } from "../utils/attempts";
import { formatIntervalDuration, formatTime } from "../utils/time";

type AttemptTimelineProps = {
  attempts: Attempt[];
  climbs: Climb[];
  onEdit?: (attempt: Attempt) => void;
};

export function AttemptTimeline({ attempts, climbs, onEdit }: AttemptTimelineProps) {
  const climbById = new Map(climbs.map((climb) => [climb.id, climb]));
  const sortedAttempts = sortAttemptsByTimestampDesc(attempts);
  const sessionIntervals = getSessionAttemptIntervals(attempts);

  return (
    <section className="section timeline-section">
      <h2>Timeline</h2>
      {sortedAttempts.length === 0 ? (
        <p className="empty">Attempts will appear here.</p>
      ) : (
        <ol className="timeline">
          {sortedAttempts.map((attempt) => {
            const climb = climbById.get(attempt.climbId);
            const intervalMs = sessionIntervals.get(attempt.id) ?? null;

            return (
              <li key={attempt.id} className="timeline-item">
                <div className="timeline-time">{formatTime(attempt.timestamp)}</div>
                <div>
                  <div className="timeline-title">
                    {climb ? (
                      <>
                        {climb.grade}
                        {climb.name ? ` ${climb.name}` : ""}
                      </>
                    ) : (
                      "Unknown climb"
                    )}
                  </div>
                  <div className={`result-pill ${attempt.result}`}>
                    {attempt.result.toUpperCase()}
                  </div>
                  {intervalMs !== null && (
                    <div className="timeline-rest">Interval from previous attempt: {formatIntervalDuration(intervalMs)}</div>
                  )}
                  {onEdit && (
                    <button className="edit-attempt-button" onClick={() => onEdit(attempt)}>
                      Edit attempt
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
