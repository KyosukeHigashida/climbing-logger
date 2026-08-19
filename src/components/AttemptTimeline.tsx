import { useState } from "react";
import type { Attempt, Climb, Gym } from "../types/domain";
import { sortAttemptsByTimestampDesc } from "../utils/attempts";
import { formatClimbLabel } from "../utils/climbs";
import { effortLabels } from "../utils/effort";
import { formatIntervalDuration, formatTime } from "../utils/time";
import { buildSessionTimeline } from "../utils/timeline";

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
  const timelineItems = [...buildSessionTimeline(attempts)].reverse();

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
          {timelineItems.length === 0 ? (
            <p className="empty">Attempts will appear here.</p>
          ) : (
            <ol className="timeline">
              {timelineItems.map((item) => {
                if (item.type === "rest") {
                  return (
                    <li key={item.id} className="timeline-item rest-block">
                      <div className="timeline-time">{formatTime(item.startedAt)}</div>
                      <div className="timeline-rest-card">REST {formatIntervalDuration(item.durationMs)}</div>
                    </li>
                  );
                }

                const attempt = item.attempt;
                const climb = climbById.get(attempt.climbId);

                return (
                  <li key={attempt.id} className="timeline-item">
                    <div className="timeline-time">{item.endedAt ? formatTime(item.endedAt) : "--"}</div>
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
                      <div className={`result-pill ${attempt.result ?? "pending"}`}>
                        {(attempt.result ?? "pending").toUpperCase()}
                      </div>
                      <div className="timeline-rest">
                        Action {item.actionDurationMs === null ? "--" : formatIntervalDuration(item.actionDurationMs)}
                      </div>
                      <div className="timeline-rest">
                        {item.startedAt ? `${formatTime(item.startedAt)}-` : "-- -"}
                        {item.endedAt ? formatTime(item.endedAt) : "--"}
                      </div>
                      {attempt.effort !== undefined && (
                        <div className="timeline-effort">Effort: {effortLabels[attempt.effort]}</div>
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
