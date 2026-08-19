import { useState } from "react";
import type { Attempt, Climb, Gym } from "../types/domain";
import { getSessionAttemptIntervals, sortAttemptsByTimestampDesc } from "../utils/attempts";
import { formatClimbLabel } from "../utils/climbs";
import { effortLabels } from "../utils/effort";
import { formatIntervalDuration, formatTime } from "../utils/time";

type AttemptTimelineProps = {
  attempts: Attempt[];
  climbs: Climb[];
  gyms?: Gym[];
  onEdit?: (attempt: Attempt) => void;
};

export function AttemptTimeline({ attempts, climbs, gyms = [], onEdit }: AttemptTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const climbById = new Map(climbs.map((climb) => [climb.id, climb]));
  const gymById = new Map(gyms.map((gym) => [gym.id, gym]));
  const sortedAttempts = sortAttemptsByTimestampDesc(attempts);
  const sessionIntervals = getSessionAttemptIntervals(attempts);

  return (
    <section className="section timeline-section" aria-label="Timeline">
      <button
        type="button"
        className="timeline-header"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <span>
          Timeline <small>· {sortedAttempts.length}</small>
        </span>
        <span className="timeline-chevron" aria-hidden="true">
          {isExpanded ? "⌃" : "⌄"}
        </span>
      </button>

      {isExpanded && (
        <div className="timeline-scroll">
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
                            {formatClimbLabel(climb)}
                            {climb.name ? ` ${climb.name}` : ""}
                            {climb.gymId && gymById.get(climb.gymId) ? (
                              <small className="climb-venue">{gymById.get(climb.gymId)?.name}</small>
                            ) : null}
                          </>
                        ) : (
                          "Unknown climb"
                        )}
                      </div>
                      <div className={`result-pill ${attempt.result}`}>
                        {attempt.result.toUpperCase()}
                      </div>
                      {attempt.effort !== undefined && (
                        <div className="timeline-effort">Effort: {effortLabels[attempt.effort]}</div>
                      )}
                      {intervalMs !== null && (
                        <div className="timeline-rest">
                          Interval from previous attempt: {formatIntervalDuration(intervalMs)}
                        </div>
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
        </div>
      )}
    </section>
  );
}
